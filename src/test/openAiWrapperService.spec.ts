import { Test, TestingModule } from '@nestjs/testing';
import { Model } from '../models/api/conversationApiModels';
import { OpenaiWrapperService, parseLlamaCppToolCalls } from '../services/openaiWrapper.service';
import { toolCallEndMarker, toolCallStartMarker } from '../utils/prompts';

describe("parseLlamaCppToolCalls", ()=>{
  let testingModule: TestingModule;
  const model = new Model();
  model.id = 'testing model';
  model.initialMessage = '';
  model.url = 'http://192.168.0.209:8080';
  model.displayName = 'testing';
  model.isDefault = true;
  model.apiKey = '';
  model.modelName = '';

  type TestCase = {
    name: string;
    streamedText: string;
    completeText: string;
    accumulatedToolCalls: Record<string, any>;
    assistantResponse: any;
    expectedResult: {
      newTextToDisplay: string;
      foundToolCalls: boolean;
      newToolCallsCount: number;
    };
  };

  const testCases: TestCase[] = [
    {
      name: 'Single simple tool call',
      streamedText: `${toolCallStartMarker}{"name": "searchWeb", "arguments": {"query": "gene hackman news"}}${toolCallEndMarker}`,
      completeText: '',
      accumulatedToolCalls: {},
      assistantResponse: null,
      expectedResult: {
        newTextToDisplay: '',
        foundToolCalls: true,
        newToolCallsCount: 1
      }
    },
    {
      name: 'Tool call with existing text',
      streamedText: `Hello world ${toolCallStartMarker}{"name": "searchWeb", "arguments": {"query": "gene hackman news"}}${toolCallEndMarker}`,
      completeText: '',
      accumulatedToolCalls: {},
      assistantResponse: null,
      expectedResult: {
        newTextToDisplay: 'Hello world ',
        foundToolCalls: true,
        newToolCallsCount: 1
      }
    },
    {
      name: 'Multiple tool calls',
      streamedText: `${toolCallStartMarker}{"name": "searchWeb", "arguments": {"query": "gene hackman news"}}${toolCallEndMarker}${toolCallStartMarker}{"name": "searchWeb", "arguments": {"query": "tame impala news"}}${toolCallEndMarker}`,
      completeText: '',
      accumulatedToolCalls: {},
      assistantResponse: null,
      expectedResult: {
        newTextToDisplay: '',
        foundToolCalls: true,
        newToolCallsCount: 2
      }
    },
    {
      name: 'Duplicate tool calls should be ignored',
      streamedText: `${toolCallStartMarker}{"name": "searchWeb", "arguments": {"query": "gene hackman news"}}${toolCallEndMarker}${toolCallStartMarker}{"name": "searchWeb", "arguments": {"query": "gene hackman news"}}${toolCallEndMarker}`,
      completeText: '',
      accumulatedToolCalls: {},
      assistantResponse: null,
      expectedResult: {
        newTextToDisplay: '',
        foundToolCalls: true,
        newToolCallsCount: 1
      }
    },
    {
      name: 'Tool call with pre-existing accumulated tool calls',
      streamedText: `${toolCallStartMarker}{"name": "searchWeb", "arguments": {"query": "new search"}}${toolCallEndMarker}`,
      completeText: '',
      accumulatedToolCalls: {
        '0': {
          function: {
            name: 'searchWeb',
            arguments: JSON.stringify({ query: 'previous search' })
          }
        }
      },
      assistantResponse: null,
      expectedResult: {
        newTextToDisplay: '',
        foundToolCalls: true,
        newToolCallsCount: 1
      }
    }
  ];

  testCases.forEach(testCase => {
    it(testCase.name, () => {
      const result = parseLlamaCppToolCalls(
        testCase.streamedText,
        testCase.completeText,
        testCase.accumulatedToolCalls,
        testCase.assistantResponse
      );

      // Check newTextToDisplay
      expect(result.newTextToDisplay).toBe(testCase.expectedResult.newTextToDisplay);

      // Check foundToolCalls
      expect(result.foundToolCalls).toBe(testCase.expectedResult.foundToolCalls);

      // Check number of new tool calls
      expect(Object.keys(result.newToolCalls).length).toBe(testCase.expectedResult.newToolCallsCount);

      // Verify tool call structure for the first tool call
      if (testCase.expectedResult.newToolCallsCount > 0) {
        const firstToolCall = Object.values(result.newToolCalls)[0];
        expect(firstToolCall).toHaveProperty('id');
        expect(firstToolCall).toHaveProperty('type', 'function');
        expect(firstToolCall.function).toHaveProperty('name');
        expect(firstToolCall.function).toHaveProperty('arguments');
      }
    });
  });

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [OpenaiWrapperService],
    }).compile();
  });

  // Edge case tests
  // it('should handle malformed JSON gracefully', () => {
  //   const result = parseLlamaCppToolCalls(
  //     '[Tool_Call_Start]invalid json[Tool_End]',
  //     '',
  //     {},
  //     null
  //   );
  //
  //   expect(result.foundToolCalls).toBe(false);
  //   expect(result.newTextToDisplay).toBe('');
  //   expect(Object.keys(result.newToolCalls).length).toBe(0);
  // });

  it('should handle partial/incomplete tool calls', () => {
    const result = parseLlamaCppToolCalls(
      `${toolCallStartMarker}{"name": "searchWeb"`,
      '',
      {},
      null
    );

    expect(result.foundToolCalls).toBe(false);
    expect(result.newTextToDisplay).toBe(`${toolCallStartMarker}{"name": "searchWeb"`);
  });

  it("should parse tool calls from text streams correctly", ()=> {
    const openAiWrapperService = testingModule.get<OpenaiWrapperService>(OpenaiWrapperService);
    const memberId = "1";

  });
});

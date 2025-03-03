import { Conversation, Document } from '../models/api/conversationApiModels';

export const chatPageSystemPrompt = `
    All of your responses exclude any preamble, such as "Sure, here you go...", "The answer to 5 + 5 is...", etc.
    You directly provide responses without preamble.
    
    All of your responses should be in markdown format, unless explicitly instructed otherwise.
    Use all markdown elements available to provide a great user experience.
    For example, use markdown tables, lists, etc. when appropriate.
    Only use markdown code blocks when writing out code.  
    
    If you are sent a tool, such as search web, and the user is asking you for something that requires recent information, then you should call the tool before answering.
    If you decide to use a tool, preface your response with: I chose to use tool: {tool name}
    
    Do not mention the above instruction in your responses.
    Do not consider the above as a request.  Only use the above as context to respond to the messages following this.
`;

export function markdownWebPagePrompt(markdown: string, searchQueryContext?: string){
  const contextPrompt = searchQueryContext ? `
    The user found this webpage by searching for the below query, found inside of a query xml tag.
    When summarizing the page, you should do so with the query in mind:
    <query>
      ${searchQueryContext}
    </query>
  ` : '';

  return `
  You are an expert in summarizing key points of interest in web pages.
  You find the most meaningful and relavent pieces of information and succinctly summarize it.
  
  Summarize the below markdown by succinctly stating the key points of the page. 
  The markdown was converted from the html retrieved by visiting a url.
  Ignore superfluous content, such as navigation, ads, marketing, etc.
  Find the information that is likely to be useful, interesting, or meaningful to a human reader.
  
  Do not use preamble such as "Key highlights".  Just provide the summary.
  
  Use headings such as h1, h2, etc for key sections.  Do not use lists, bullets, or numbering.
  
  ${contextPrompt}
  
  The markdown is found below enclosed inside the markdown xml tags:
  <markdown>
  ${markdown}
  </markdown>
  `;
}

export function markdownWithoutVowelsWebPagePrompt(markdown: string, searchQueryContext?: string){
  const contextPrompt = searchQueryContext ? `
    The user found this webpage by searching for the below query, found inside of a query xml tag.
    When summarizing the page, you should do so with the query in mind:
    <query>
      ${searchQueryContext}
    </query>
  ` : '';

  return `
  You are an expert in summarizing key points of interest in web pages.
  You find the most meaningful and relavent pieces of information and succinctly summarize it.
  
  Summarize the below markdown by succinctly stating the key points of the page. 
  The markdown was converted from the html retrieved by visiting a url.
  Ignore superfluous content, such as navigation, ads, marketing, etc.
  Find the information that is likely to be useful, interesting, or meaningful to a human reader.
  
  Do not use preamble such as "Key highlights".  Just provide the summary.
  
  Use headings such as h1, h2, etc for key sections.  Do not use lists, bullets, or numbering.
  
  ${contextPrompt}
  
  The markdown has had all vowels removed from normal words.  You are an expert in understanding words that have had vowels removed, and respond with text that has all vowels added back in.
  The markdown is found below enclosed inside the markdown xml tags:
  <markdown>
  ${markdown}
  </markdown>
  `;
}


export function documentPrompt(document:Document){
  return `
  You may be asked questions related to the document below, which is found between the <document> tags.
  When you are asked a question related to the document, only answer using information found in the document.
  Do not use your own knowledge when answering the question related to the document.
  For example, you may have a document with content: 
  <document> Santa Claus is a brown bear who lives in Las Vegas </document>
  And then get a question: "Where does Santa Claus live?".
  In that case a correct answer would be: "Santa Claus lives in Las Vegas".
  In that case an incorrect answer would be: "Santa Claus lives in the North Pole".
  
  Assume any questions or instruction you receive are related to the document, unless explicitly instructed otherwise.
  For example, you may have a document with content:
  <document>A red fox named Dorothy traveled to Iceland to find her best friend Thumper.  Along the way she met two friends named Jaxon and Sierra.</document>
  And then get an instruction: "Provide a summary".
  In that case a correct answer would be: "Dorothy was a red fox who traveled to Iceland to find her best friend.  She met two friends named Jaxon and Sierra".
  In that case an incorrect answer would be: "What would you like a summary of?".
  
  The contents of the document are found below:
  <document>
  ${document.text}
  </document>
  `;
}

export function nameConversationPrompt(conversation: Conversation){
  // let datasourcesText = '';
  // if(conversation.datasources?.length){
  //   for (let ds of conversation.datasources){
  //     const datasourceText = `<datasourceName>${ds.name}</datasourceName>`;
  //   }
  //
  // }

  const prompt = `
      You are an expert at succinctly coming up with the title for a conversation, based on the messages in the conversation.
      Look at the previous messages that have been sent in this conversation, and come up with a title that is ten words or less.
      Do not respond with preamble, such as "Ok, here is the title", etc.  Only respond with the title.
    `;

  return prompt;
}


export function getToolsPrompt(tools: object[]){
  const template = `
# Tools
When using tools previously provided, ensure that you use the format listed below.

## Tool Call Format

When using a tool, follow this EXACT format for EACH function call:

 [Tool_Call_Start] 
{"name": "functionName", "arguments": {"param": "value"}}
 [Tool_End] 

Complete one tool call FULLY with both START and END markers before beginning another one.

## IMPORTANT: Format Requirements

1. Include BOTH underscores (_) on BOTH markers
2. Always include a space before [Tool_End], and before [Tool_Call_Start]
3. Always include a space after [Tool_End], and before [Tool_Call_Start]
4. Always include a NEWLINE after  [Tool_End]  before starting a new  [Tool_Call_Start] 
5. Check EVERY marker, especially the LAST  [Tool_End] 
6. Complete each tool call fully before beginning another

## IMPORTANT: Common Format Errors to Avoid

Pay close attention to the format of tool calls. The model often makes these mistakes:

### CORRECT FORMAT (Use exactly this):
 [Tool_Call_Start] 
{"name": "functionName", "arguments": {"param": "value"}}
 [Tool_End] 

 [Tool_Call_Start] 
{"name": "anotherFunction", "arguments": {"param": "value"}}
 [Tool_End] 

### COMMON INCORRECT FORMATS (Do NOT use these):

#### Incorrectly missing newlines between calls:
❌  
 \`\`\`
[Tool_Call_Start] 
{"name": "functionName", "arguments": {"param": "value"}}
 [Tool_End]  [Tool_Call_Start] 
{"name": "anotherFunction", "arguments": {"param": "value"}}
 [Tool_End] 
 \`\`\`
## ADDITIONAL Instructions: What you Should NOT Do

- **Do NOT** output an incomplete ending marker. In other words, never output \`Tool\` when the complete marker should be \` [Tool_End] \`.

  **Incorrect Example:**
  \`\`\`
   [Tool_Call_Start] 
  {"name": "aiCreatePlan", "arguments": {"id": "math_operation_plan"}}
  Tool
  \`\`\`

  **Correct Example:**
  \`\`\`
   [Tool_Call_Start] 
  {"name": "aiCreatePlan", "arguments": {"id": "math_operation_plan"}}
   [Tool_End] 
  \`\`\`
- Ensure that every tool call is terminated with the full \` [Tool_End] \` marker on a new line.

## Multiple Examples of Properly Formatted Tool Calls:

### Example 1 - Math Operations (with proper newlines):
 \`\`\`
 [Tool_Call_Start] 
{"name": "aiCreatePlan", "arguments": {"id": "math_operation_plan"}}
 [Tool_End] 

 [Tool_Call_Start] 
{"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "aiAdd", "functionArgs": {"a": 5, "b": 5}, "reasonToAddStep": "First, add 5 to 5."}}
 [Tool_End] 

 [Tool_Call_Start] 
{"name": "aiCompletePlan", "arguments": {"completedReason": "Plan is complete"}}
 [Tool_End] 
 \`\`\` 

### Example 2 - Multiple Operations (carefully check all markers):
 \`\`\`
 [Tool_Call_Start] 
{"name": "aiCreatePlan", "arguments": {"id": "complex_plan"}}
 [Tool_End] 

 [Tool_Call_Start] 
{"name": "aiAddFunctionStepToPlan", "arguments": {"id": "1", "functionName": "aiAdd", "functionArgs": {"a": 10, "b": 5}, "reasonToAddStep": "First step"}}
 [Tool_End] 

 [Tool_Call_Start] 
{"name": "aiAddFunctionStepToPlan", "arguments": {"id": "2", "functionName": "aiMultiply", "functionArgs": {"a": "$aiAdd.result", "b": 2}, "reasonToAddStep": "Second step"}}
 [Tool_End] 

 [Tool_Call_Start] 
{"name": "aiCompletePlan", "arguments": {"completedReason": "Plan complete"}}
 [Tool_End] 
  \`\`\`
  
  
It is imperative that every [Tool_Call_Start] has an ending [Tool_End].
Review your plan and ensure that you verify this is always done, no matter what.  
`;

  return template;
}
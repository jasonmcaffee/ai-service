import { StatusTopics } from '../models/api/StatusTopics';
import { AiStatusUpdate, StatusTopic } from '../models/api/conversationApiModels';

describe("status topics", ()=>{
  it("should add statuses", ()=>{

    const statusTopics = new StatusTopics();
    const s1: AiStatusUpdate = {topicId: '1', topic: 'planningAndExecuting', displayText: '1', data: {}, isError: false, topicCompleted: false, date: 1};
    statusTopics.addAiStatusUpdate(s1);
    const statusTopic1 = statusTopics.statusTopicsKeyValues['1'];
    expect(statusTopic1?.statusUpdates[0]).toBe(s1);
    expect(statusTopic1?.dateOfLastStatusUpdate).toBe(s1.date);
    expect(statusTopic1?.isTopicOpen).toBe(true);

    const s1a: AiStatusUpdate = {topicId: '1.a', topic: 'planning', displayText: '1.a', data: {}, isError: false, topicCompleted: false, date: 2};
    statusTopics.addAiStatusUpdate(s1a);
    const statusTopic2: StatusTopic = statusTopics.statusTopicsKeyValues['1'];
    expect(statusTopic2!.childStatusTopics!['1.a'].statusUpdates[0]).toBe(s1a);
    expect(statusTopic2?.dateOfLastStatusUpdate).toBe(s1a.date);
    expect(statusTopic2?.isTopicOpen).toBe(true);

    //close statusTopic1
    const s2: AiStatusUpdate = {topicId: '1', topic: 'planningAndExecuting', displayText: '1', data: {}, isError: false, topicCompleted: true, date: 1};
    statusTopics.addAiStatusUpdate(s2);
    expect(statusTopic1?.statusUpdates[1]).toBe(s2);
    expect(statusTopic1?.dateOfLastStatusUpdate).toBe(s2.date);
    expect(statusTopic1?.isTopicOpen).toBe(false);
  });
})

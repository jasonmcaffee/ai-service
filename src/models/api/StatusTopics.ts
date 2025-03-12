import { AiStatusUpdate, StatusTopic, StatusTopicKeyValues } from './conversationApiModels';



/**
 * Wrapper for StatusTopics, where we build a tree of StatusTopics as we receive AiStatusUpdates from the server.
 * Since the server doesn't track parent/child relationships of topics (e.g. a planningAndExecuting topic will have a topic for planning, web tools, etc.),
 * we need to track this relationship ourselves based on whether a topic is open/complete.
 * e.g. If I get a status update for topic 1 and the topic is still open, and then I get a status update for topic 2, topic 2 should be added as a child of topic 1.
 *
 * {
 *   '0': {
 *     isTopicOpen: false,
 *     dateOfLastStatusUpdate: 1,
 *     statusUpdates: [
 *       {topicId: '0', topic: 'planningAndExecuting', displayText: 'planning and executing', data: {}, isError: false, topicCompleted: true, date: 0},
 *     ],
 *     childStatusTopics: {
 *       '0.a': {
 *         statusUpdates: [
 *           {topicId: '0.a.1', topic: 'planning', displayText: 'creating a plan', data: {}, isError: false, topicCompleted: false, date: 1},
 *         ]
 *       }
 *     }
 *   }
 * }
 */
export class StatusTopics {
  constructor(public readonly statusTopicsKeyValues: StatusTopicKeyValues = {}) {}

  addAiStatusUpdate(aiStatusUpdate: AiStatusUpdate) {
    const topicId = aiStatusUpdate.topicId!;
    // Depth first search of the entire tree to find an existing topic by id, so we can add status to the topic.
    const existingTopic = findExistingTopicById(topicId, this.statusTopicsKeyValues);

    if (!existingTopic) {
      // Find latest open topic. If it exists, add the aiStatusUpdate to its list of statusUpdates,
      // and update the latestOpenTopic isTopicOpen and dateOfLastStatusUpdate.
      const latestOpenTopic = findLatestOpenTopicThatIsntTopicId(topicId, this.statusTopicsKeyValues);

      if (latestOpenTopic) {
        latestOpenTopic.childStatusTopics = latestOpenTopic.childStatusTopics || {};
        ensureStatusTopicForTopicIdExists(topicId, latestOpenTopic.childStatusTopics);

        const childTopic = latestOpenTopic.childStatusTopics[topicId];
        childTopic.statusUpdates.push(aiStatusUpdate);
        latestOpenTopic.dateOfLastStatusUpdate = aiStatusUpdate.date;
        latestOpenTopic.isTopicOpen = !aiStatusUpdate.topicCompleted;
        latestOpenTopic.lastAiStatusUpdate = aiStatusUpdate;
      } else {
        // If no latest open topic, add the status update to the root statusTopics
        ensureStatusTopicForTopicIdExists(topicId, this.statusTopicsKeyValues);
        const statusTopic = this.statusTopicsKeyValues[topicId];
        statusTopic.statusUpdates.push(aiStatusUpdate);
        statusTopic.dateOfLastStatusUpdate = aiStatusUpdate.date;
        statusTopic.isTopicOpen = !aiStatusUpdate.topicCompleted;
        statusTopic.lastAiStatusUpdate = aiStatusUpdate;
      }
    } else {
      existingTopic.statusUpdates.push(aiStatusUpdate);
      existingTopic.dateOfLastStatusUpdate = aiStatusUpdate.date;
      existingTopic.isTopicOpen = !aiStatusUpdate.topicCompleted;
      existingTopic.lastAiStatusUpdate = aiStatusUpdate;
    }
  }
}

function ensureStatusTopicForTopicIdExists(topicId: string, statusTopics: StatusTopicKeyValues) {
  if (!statusTopics[topicId]) {
    statusTopics[topicId] = { statusUpdates: [] };
  }
}

// Depth first search of topic object to find something by id.
export function findExistingTopicById(
  statusTopicId: string,
  statusTopics: StatusTopicKeyValues
): StatusTopic | undefined {
  // Check if the topic exists at the current level
  if (statusTopics[statusTopicId]) {
    return statusTopics[statusTopicId];
  }

  // Search in all child topics
  for (const topicId in statusTopics) {
    const statusTopic = statusTopics[topicId];
    if (!statusTopic.childStatusTopics) {
      continue;
    }

    const result = findExistingTopicById(statusTopicId, statusTopic.childStatusTopics);
    if (result) {
      return result;
    }
  }

  return undefined;
}

/**
 * Get the most recent open topic, so we can add a child topic to it if it exists.
 */
export function findLatestOpenTopicThatIsntTopicId(
  statusTopicId: string,
  statusTopics: StatusTopicKeyValues
): StatusTopic | undefined {
  let result: StatusTopic | undefined;

  for (const topicId in statusTopics) {
    if (topicId === statusTopicId) {
      continue;
    }

    const statusTopic = statusTopics[topicId];
    if (!statusTopic.isTopicOpen) { // If complete, skip
      continue;
    }

    if (!result) {
      result = statusTopic;
      continue;
    }

    if (statusTopic.dateOfLastStatusUpdate! > result.dateOfLastStatusUpdate!) {
      result = statusTopic;
    }

    if (!statusTopic.childStatusTopics) {
      continue;
    }

    const childResult = findLatestOpenTopicThatIsntTopicId(statusTopicId, statusTopic.childStatusTopics);
    if (childResult && childResult.dateOfLastStatusUpdate! > result.dateOfLastStatusUpdate!) {
      result = childResult;
    }
  }

  return result;
}

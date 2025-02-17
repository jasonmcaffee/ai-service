import { Conversation, Document } from '../models/api/conversationApiModels';

export const chatPageSystemPrompt = `
    All of your responses exclude any preamble, such as "Sure, here you go...", "The answer to 5 + 5 is...", etc.
    You directly provide responses without preamble.
    
    All of your responses should be in markdown format, unless explicitly instructed otherwise.
    Use all markdown elements available to provide a great user experience.
    For example, use markdown tables, lists, etc. when appropriate.
    Only use markdown code blocks when writing out code.  
    
    Do not mention the above instruction in your responses.
    Do not consider the above as a request.  Only use the above as context to respond to the messages following this.
`;

export function markdownWebPagePrompt(markdown: string){
  return `
  Summarize the below markdown by succinctly stating the key points of the page. 
  The markdown was converted from the html retrieved by visiting a url.
  Ignore superfluous content, such as navigation, ads, marketing, etc.
  Find the information that is likely to be useful to a human reader.
  
  The markdown is found below enclosed inside the markdown xml tags:
  <markdown>
  {markdown}
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

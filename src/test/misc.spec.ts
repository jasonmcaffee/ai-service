import * as fs from 'fs';
import * as path from 'path';
import { convertMarkdownToPlainText } from '../utils/utils';

describe("misc", () =>{
    it("should", ()=>{
        const logFilePath = path.join("./", 'llama_server_output.log');
        // const content = fs.readFileSync(logFilePath, 'utf8');
        let content = fs.readFileSync(logFilePath, 'utf16le').trim();
        expect(content.length > 0 ).toBe(true);
        const lastPart = content.substring(content.length - 300, content.length);
        const lastPartStr = lastPart.toString();
        expect(content.indexOf('server is listening on') >=0 ).toBe(true);
    });

    it("markdown", ()=>{
        const markdownText: string = `
# Main Title

## 2. **Subtitle**

This is a paragraph with some **bold** text and some *italic* text.

### Another Section

- **Important Item 1**
- Item 2
- *Item 3*

#### Conclusion

**Final thoughts:** Markdown is great for formatting text!
`;

        const converted = convertMarkdownToPlainText(markdownText);
        console.log('converted: ', converted);
    });
});

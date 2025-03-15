import * as fs from 'fs';
import * as path from 'path';

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
});
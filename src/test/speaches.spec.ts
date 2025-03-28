import { Test, TestingModule } from '@nestjs/testing';
import { ModelsService } from '../services/models.service';
import { ModelsRepository } from '../repositories/models.repository';
import { wait } from '../utils/utils';
import OpenAI from 'openai';
const player = require('play-sound')();
import * as fs from 'fs';

describe("thing", ()=>{

  const filePath = './whiskers.mp3';

  it("should text to speech", async ()=> {
    const openAi = new OpenAI({baseURL: 'http://192.168.0.209:8000/v1', apiKey:'na'});
    const result = await openAi.audio.speech.create({
      model: 'hexgrad/Kokoro-82M',
      //@ts-ignore
      voice: 'af_sky', // 'af_nicole', // 'af_sky', //'bm_lewis', //'am_michael', //'am_adam', //'af',
      input: 'Hello.  I am a cat named Whiskers, lord of the underworld and purveyor of doom. Gaze into my blackened eyes as the sunlight dies, and the earth fades into oblivion.',
      response_format: 'mp3',
      speed: 1,
    });
    const audioBuffer = await result.arrayBuffer(); // Adjust according to your API response format
    const nodeBuffer = Buffer.from(audioBuffer);


    fs.writeFileSync(filePath, nodeBuffer);

    player.play(filePath);



    // await wait(1 * 60 * 1000);

  });

  it("should speech to text", async ()=>{
    const start = Date.now();
    const openAi = new OpenAI({baseURL: 'http://192.168.0.209:8000/v1', apiKey:'na'});
    const speechToTextResult = await openAi.audio.transcriptions.create({
      //@ts-ignore
      model: 'Systran/faster-whisper-small',
      file: fs.createReadStream(filePath), // Pass the file stream for the transcription
      language: 'en',  // Specify the language of the audio
    });
    console.log(`finished in ${Date.now() - start} ms`, speechToTextResult.text);
  })
});

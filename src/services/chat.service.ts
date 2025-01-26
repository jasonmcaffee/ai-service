import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ChatService {
  async streamInference(prompt: string): Promise<Observable<{ data: string }>> {
    // For demo purposes, we're using a simple interval to simulate streaming data
    const story = [
      'Once upon a time, there was a little cow named Moo.',
      'Moo loved to roam the fields, eating grass and playing with the other animals.',
      'One day, Moo decided to venture further than usual and explore the nearby forest.',
      'In the forest, Moo found a mysterious glowing tree and a friendly rabbit who offered a carrot.',
      'After a long day of adventures, Moo returned to the farm, feeling happy and tired.',
      'And so, Moo’s adventure ended, but the next day was just the beginning of many more!'
    ];

    // Return an observable that emits each part of the story at intervals (every 3 seconds)
    return interval(3000).pipe(
      map((index) => {
        if (index < story.length) {
          return { data: story[index] };
        } else {
          // End the stream when all parts are delivered
          throw new Error('Stream ended');
        }
      })
    );
  }
}

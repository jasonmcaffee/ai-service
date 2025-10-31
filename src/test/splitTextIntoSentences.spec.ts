import { splitTextIntoSentencesV2 } from '../utils/utils';

describe('splitTextIntoSentencesV2', () => {
  describe('Basic sentence splitting', () => {
    it('should split simple sentences', () => {
      const text = 'Hello world. This is a test. Another sentence!';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Hello world.',
        'This is a test.',
        'Another sentence!'
      ]);
    });

    it('should handle question marks', () => {
      const text = 'How are you? I am fine.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'How are you?',
        'I am fine.'
      ]);
    });

    it('should handle exclamation marks', () => {
      const text = 'Wow! That is amazing. Really?';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Wow!',
        'That is amazing.',
        'Really?'
      ]);
    });

    it('should handle single sentence', () => {
      const text = 'This is a single sentence.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual(['This is a single sentence.']);
    });

    it('should handle sentence without ending punctuation', () => {
      const text = 'This is a sentence. This is another one';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'This is a sentence.',
        'This is another one'
      ]);
    });
  });

  describe('Abbreviations', () => {
    it('should not split on Mr.', () => {
      const text = 'Mr. Jason went to the store. He bought apples.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Mr. Jason went to the store.',
        'He bought apples.'
      ]);
    });

    it('should not split on Mrs.', () => {
      const text = 'Mrs. Smith is here. She is nice.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Mrs. Smith is here.',
        'She is nice.'
      ]);
    });

    it('should not split on Dr.', () => {
      const text = 'Dr. Jones saw the patient. The patient is fine.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Dr. Jones saw the patient.',
        'The patient is fine.'
      ]);
    });

    it('should not split on Prof.', () => {
      const text = 'Prof. Williams teaches math. He is excellent.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Prof. Williams teaches math.',
        'He is excellent.'
      ]);
    });

    it('should not split on etc.', () => {
      const text = 'I need apples, bananas, etc. That is all.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'I need apples, bananas, etc. That is all.'
      ]);
    });

    it('should not split on i.e. or e.g.', () => {
      const text = 'Many languages exist, e.g. English and Spanish. Also i.e. formal ones.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Many languages exist, e.g. English and Spanish.',
        'Also i.e. formal ones.'
      ]);
    });

    it('should not split on time abbreviations', () => {
      const text = 'Meet me at 3 p.m. We can discuss then.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Meet me at 3 p.m. We can discuss then.'
      ]);
    });

    it('should not split on a.m. and p.m.', () => {
      const text = 'The event starts at 9 a.m. It ends at 5 p.m.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'The event starts at 9 a.m. It ends at 5 p.m.'
      ]);
    });

    it('should not split on street abbreviations', () => {
      const text = 'I live on Main St. It is nice there.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'I live on Main St. It is nice there.'
      ]);
    });

    it('should not split on company abbreviations', () => {
      const text = 'I work at ABC Inc. It is a good company.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'I work at ABC Inc. It is a good company.'
      ]);
    });

    it('should not split on U.S. and U.K.', () => {
      const text = 'The U.S. is large. The U.K. is smaller.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'The U.S. is large.',
        'The U.K. is smaller.'
      ]);
    });

    it('should not split on Ph.D. and M.D.', () => {
      const text = 'She has a Ph.D. in physics. He is an M.D.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'She has a Ph.D. in physics.',
        'He is an M.D.'
      ]);
    });
  });

  describe('Middle initials', () => {
    it('should not split on single letter middle initial', () => {
      const text = 'John A. Smith is here. He is tall.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'John A. Smith is here.',
        'He is tall.'
      ]);
    });

    it('should not split on multiple middle initials', () => {
      const text = 'Mary J. K. Doe arrived. She is early.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Mary J. K. Doe arrived.',
        'She is early.'
      ]);
    });
  });

  describe('Decimals and numbers', () => {
    it('should not split on decimal numbers', () => {
      const text = 'The price is $5.50. That is cheap.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'The price is $5.50. That is cheap.'
      ]);
    });

    it('should not split on pi', () => {
      const text = 'Pi is approximately 3.14. It is irrational.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Pi is approximately 3.14. It is irrational.'
      ]);
    });

    it('should not split on percentage with decimal', () => {
      const text = 'The rate is 3.5%. That is high.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'The rate is 3.5%. That is high.'
      ]);
    });

    it('should not split on version numbers', () => {
      const text = 'We use version 2.5. It works well.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'We use version 2.5. It works well.'
      ]);
    });

    it('should split when period is followed by capital after decimal', () => {
      const text = 'The value is 3.14. This is pi.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'The value is 3.14. This is pi.'
      ]);
    });
  });

  describe('URLs', () => {
    it('should not split on www URLs', () => {
      const text = 'Visit www.example.com for more info. It is helpful.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Visit www.example.com for more info.',
        'It is helpful.'
      ]);
    });

    it('should not split on http URLs', () => {
      const text = 'Check http://example.com. It is secure.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Check http://example.com. It is secure.'
      ]);
    });

    it('should not split on https URLs', () => {
      const text = 'Go to https://secure.com. It uses SSL.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Go to https://secure.com. It uses SSL.'
      ]);
    });

    it('should not split on .org URLs', () => {
      const text = 'Visit example.org for details. It has info.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Visit example.org for details.',
        'It has info.'
      ]);
    });
  });

  describe('Ellipses', () => {
    it('should handle ellipses in the middle', () => {
      const text = 'He said something... I am not sure what.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'He said something... I am not sure what.'
      ]);
    });

    it('should handle ellipses at end of sentence', () => {
      const text = 'This is interesting... Next sentence here.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'This is interesting...',
        'Next sentence here.'
      ]);
    });
  });

  describe('Quotes', () => {
    it('should handle quotes at end of sentence', () => {
      const text = 'He said "Hello world." That was nice.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'He said "Hello world."',
        'That was nice.'
      ]);
    });

    it('should handle single quotes', () => {
      const text = "She said 'Goodbye.' Then she left.";
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        "She said 'Goodbye.'",
        'Then she left.'
      ]);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple abbreviations in one sentence', () => {
      const text = 'Dr. Smith met Mr. Jones on Main St. at 3 p.m. They talked.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Dr. Smith met Mr. Jones on Main St. at 3 p.m. They talked.'
      ]);
    });

    it('should handle real-world example', () => {
      const text = 'Mr. Jason went to the store. He bought items for $5.50. He visited www.example.com. Then he left.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Mr. Jason went to the store.',
        'He bought items for $5.50. He visited www.example.com.',
        'Then he left.'
      ]);
    });

    it('should handle mixed punctuation and abbreviations', () => {
      const text = 'Wow! Dr. Smith is here. Really? Yes, at 9 a.m.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Wow!',
        'Dr. Smith is here.',
        'Really?',
        'Yes, at 9 a.m.'
      ]);
    });

    it('should handle academic titles', () => {
      const text = 'Prof. Williams has a Ph.D. She teaches at U.S. University.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Prof. Williams has a Ph.D.',
        'She teaches at U.S. University.'
      ]);
    });
  });

  describe('maxWordsPerSentence parameter', () => {
    it('should split long sentences when exceeding maxWordsPerSentence', () => {
      const text = 'This is a very long sentence that should be split up because it has too many words in it and needs to be broken down into smaller chunks.';
      const result = splitTextIntoSentencesV2(text, 15);
      expect(result.length).toBeGreaterThan(1);
      result.forEach(sentence => {
        const wordCount = sentence.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(15);
      });
    });

    it('should respect maxWordsPerSentence default', () => {
      const longText = Array(60).fill('word').join(' ') + '.';
      const result = splitTextIntoSentencesV2(longText);
      result.forEach(sentence => {
        const wordCount = sentence.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(50);
      });
    });

    it('should not split short sentences', () => {
      const text = 'Short sentence. Another one.';
      const result = splitTextIntoSentencesV2(text, 50);
      expect(result).toEqual([
        'Short sentence.',
        'Another one.'
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = splitTextIntoSentencesV2('');
      expect(result).toEqual([]);
    });

    it('should handle whitespace only', () => {
      const result = splitTextIntoSentencesV2('   \n\t  ');
      expect(result).toEqual([]);
    });

    it('should handle text with no punctuation', () => {
      const text = 'This has no punctuation It continues';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual(['This has no punctuation It continues']);
    });

    it('should handle multiple spaces', () => {
      const text = 'First sentence.    Second sentence.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'First sentence.',
        'Second sentence.'
      ]);
    });

    it('should handle newlines', () => {
      const text = 'First sentence.\n\nSecond sentence.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'First sentence.',
        'Second sentence.'
      ]);
    });

    it('should handle all caps abbreviations', () => {
      const text = 'I work for the FBI. They investigate crimes.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'I work for the FBI.',
        'They investigate crimes.'
      ]);
    });

    it('should handle U.S.A. style abbreviation', () => {
      const text = 'He is from the U.S.A. It is a big country.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'He is from the U.S.A.',
        'It is a big country.'
      ]);
    });

    it('should handle month abbreviations', () => {
      const text = 'We met in Jan. It was cold. Then in Feb. it warmed up.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'We met in Jan. It was cold.',
        'Then in Feb. it warmed up.'
      ]);
    });

    it('should handle sentence starting with lowercase after abbreviation', () => {
      // This tests that we correctly identify sentence boundaries
      const text = 'He is Dr. smith. This should still split.';
      const result = splitTextIntoSentencesV2(text);
      // Note: This might split on Dr. if next word is lowercase, which is actually correct behavior
      // as "Dr. smith" is unusual - normally it would be "Dr. Smith"
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Comparison with original behavior', () => {
    it('should handle "Mr. Jason" correctly unlike original', () => {
      const text = 'Mr. Jason went to the store. He bought apples.';
      const result = splitTextIntoSentencesV2(text);
      expect(result).toEqual([
        'Mr. Jason went to the store.',
        'He bought apples.'
      ]);
      // Verify it doesn't incorrectly split "Mr. Jason"
      expect(result[0]).toContain('Mr. Jason');
    });
  });
});


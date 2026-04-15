import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern,
} from 'obscenity';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const nlWords = require('./profanity-nl.json');

// Add Dutch words from LDNOOBW + extras to the English dataset
nlWords.forEach((word) => {
  englishDataset.addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: word }).addPattern(parseRawPattern(word))
  );
});

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  blacklistMatcherTransformers: englishRecommendedTransformers,
});

export function containsProfanity(text) {
  return matcher.hasMatch(text);
}

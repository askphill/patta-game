const {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern,
} = require('obscenity');

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

function containsProfanity(text) {
  return matcher.hasMatch(text);
}

module.exports = { containsProfanity };

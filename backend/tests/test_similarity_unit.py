from app.services.similarity import tokenize, jaccard_similarity, apply_similarity_penalty


def test_tokenize_basic():
    tokens = tokenize("Hello, world!", ngram_n=2)
    assert isinstance(tokens, set)
    assert len(tokens) > 0


def test_jaccard_similarity():
    a = {"ab", "bc", "cd"}
    b = {"bc", "cd", "de"}
    assert jaccard_similarity(a, b) == 2 / 4


def test_apply_similarity_penalty():
    assert apply_similarity_penalty(10.0, 0.25) == 7.5
    assert apply_similarity_penalty(5.0, 1.0) == 0.0

from app.services.similarity import tokenize, jaccard_similarity, apply_similarity_penalty


def test_tokenize_basic():
    s = "この論文は手法の説明が丁寧でわかりやすい"
    tokens = tokenize(s, ngram_n=2)
    assert isinstance(tokens, set)
    assert len(tokens) > 0


def test_jaccard_similarity_perfect():
    a = tokenize("abcdefg", ngram_n=2)
    b = tokenize("abcdefg", ngram_n=2)
    assert jaccard_similarity(a, b) == 1.0


def test_jaccard_similarity_different():
    a = tokenize("abcd", ngram_n=2)
    b = tokenize("wxyz", ngram_n=2)
    assert jaccard_similarity(a, b) == 0.0


def test_apply_similarity_penalty():
    assert apply_similarity_penalty(10.0, 0.2) == 8.0
    assert apply_similarity_penalty(5.0, 0.0) == 5.0
    assert apply_similarity_penalty(10.0, 1.0) == 0.0

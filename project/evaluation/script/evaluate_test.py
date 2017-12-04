import unittest
import evaluate

class EvaluationTest(unittest.TestCase):
    def testAgreementForOneQuestion(self):
        total_participants = 10
        matched_predictions = { "q0": { "1": 5 }}
        agreement, filtered_agreement = evaluate.calculate_agreement(matched_predictions, total_participants)
        self.assertEqual(0.5, agreement)
        self.assertEqual(0, filtered_agreement)
        matched_predictions = {"q0": {"1": 5, "5": 10, "7": 0}}
        agreement, filtered_agreement = evaluate.calculate_agreement(matched_predictions, total_participants)
        self.assertEqual(0.5, agreement)
        self.assertEqual(0.5, filtered_agreement)

    def testAgreementIsAveragedOverAllAnswers(self):
        total_participants = 10
        matched_predictions = {"q0": {"1": 5, "5": 10, "7": 0}, "q1": {"1": 3, "5": 2}}
        agreement, filtered_agreement = evaluate.calculate_agreement(matched_predictions, total_participants)
        self.assertEqual(0.4, agreement)
        self.assertAlmostEqual(0.4, filtered_agreement, 10)

    def testMatchPredictions(self):
        algorithm_predictions = {"q0": ["2"]}
        user_answers = {"q0": {"1": [1, 2], "3": [2, 3]}}
        matches, fuzzy_matches = evaluate.match_predicitons(algorithm_predictions, user_answers)
        expected_matches = {"q0": {"2": 0}}
        expected_fuzzy_matches = {"q0": {"2": 3}}
        self.assertEqual(expected_matches, matches, "should include lines that are not matched with 0")
        self.assertEqual(expected_fuzzy_matches, fuzzy_matches, "should include lines +-1, without duplicates")

        # should not count fuzzy matches twice
        algorithm_predictions = {"q0": ["1", "5", "6"], "q1": ["7", "9"]}
        user_answers = {"q0": {"1": [1, 2, 3], "6": [1]}, "q1": {"3": [2, 3], "8": [1, 3]}}
        matches, fuzzy_matches = evaluate.match_predicitons(algorithm_predictions, user_answers)
        expected_matches = {"q0": {"1": 3, "5": 0, "6": 1}, "q1": {"7": 0, "9": 0}}
        expected_fuzzy_matches = {"q0": {"1": 3, "5": 0, "6": 1}, "q1": {"7": 0, "9": 2}}
        self.assertEqual(expected_matches, matches)
        self.assertEqual(expected_fuzzy_matches, fuzzy_matches)

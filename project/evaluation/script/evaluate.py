import csv
import json
import re
from natural_keys import natural_keys
from os import path
from collections import Iterable
from itertools import chain


class QuestionAnswers:
    noTypeScript = "I have never written or read TypeScript before"
    noProgramming = "I have never written a software program before"
    beginner = "Beginner"
    advanced = "Advanced"
    proficient = "Proficient"


class QuestionColumns:
    experienceProgramming = 3
    experienceTypeScript = 4
    q1, q2, q3, q4, q5, q6, q7, q8, q9, q10 = range(7, 17)
    marked1, marked1a, marked2, marked2a, marked3, marked3a, marked4, marked4a, marked5, marked5a, marked6,\
        marked6a, marked7, marked7a, marked8, marked8a, marked9, marked9a, marked10, marked10a = range(17, 37)


def no_typescript_no_programming(row):
    return (row[QuestionColumns.experienceTypeScript] == QuestionAnswers.noTypeScript or
            row[QuestionColumns.experienceProgramming] == QuestionAnswers.noProgramming)


def merge(dict1, dict2):
    result = {}
    for k, v in chain(dict1.items(), dict2.items()):
        list = result.get(k, [])
        if isinstance(v, Iterable):
            list += v
        else:
            list.append(v)
        result[k] = list
    return result


def load_answers(filename, only_typescript_developers):
    result = {}
    user_id = 0
    with open(filename) as opened_file:
        reader = csv.reader(opened_file, delimiter=';', quotechar='"')
        questions = {k: v for k, v in vars(QuestionColumns).iteritems() if not k.startswith("__")}

        # get all answers as list, accessible by question identifier
        next(reader)  # skip the header
        next(reader)  # skip the first entry, as it's completely empty
        for row in reader:
            if only_typescript_developers and no_typescript_no_programming(row):
                continue
            user_id += 1
            for question_id, question_column in questions.iteritems():
                selected_lines = re.sub(r"\s+", "", row[question_column]).split(",")
                lines_to_user = {line: user_id for line in selected_lines}
                question_answers = merge(result.get(question_id, {}), lines_to_user)
                result[question_id] = question_answers
    return (result, user_id)  # using the user_id as count


def generate_charts(question_names, user_selections, algorithm_selections,
                    template_filename, answer_count, algorithm_selection_to_line):
    result = []
    template = ""
    with open(template_filename) as template_file:
        template = template_file.read()

    for question_name in sorted(question_names.iterkeys(), key=natural_keys):
        question_identifier = question_names[question_name]

        current_chart = template
        survey_image_path = "survey_images/"
        if question_identifier.startswith("q"):
            survey_image_path += "01_unmarked/"
        else:
            survey_image_path += "02_marked/"
        survey_image_path += question_identifier + ".png"
        current_chart = current_chart.replace("PLACEHOLDER_SURVEY_IMAGE", survey_image_path)
        current_chart = current_chart.replace("PLACEHOLDER_CAPTION", question_name)
        current_chart = current_chart.replace("PLACEHOLDER_LABEL", "fig:" + question_identifier)

        algorithm_line_selection_counts = algorithm_selections[question_identifier]
        user_line_selection_counts = user_selections[question_identifier]
        # "markedX" and "markedXa" questions are a pair. Use the "markedXa" answers as "user_line"s, as those are the
        # lines that participants wanted additional comments on.
        # Replace the "no lines" (empty) one with the one from the "markedX" one though, as this one then means
        # "I don't want any comments here", which is what it means in all "q" cases as well
        if question_identifier.startswith("m"):
            line_map = algorithm_selection_to_line[question_identifier]
            updated_map = {}
            for selection_number, line_number in line_map.iteritems():
                updated_map[line_number] = algorithm_line_selection_counts[selection_number]
            algorithm_line_selection_counts = updated_map
            user_line_selection_counts = user_selections[question_identifier + "a"]
            if "" in user_line_selection_counts:
                user_line_selection_counts.pop("")
            if "" in user_selections[question_identifier]:
                user_line_selection_counts[""] = user_selections[question_identifier].get("")

        all_selected_lines = sorted(set(algorithm_line_selection_counts.keys() + user_line_selection_counts.keys()), key=natural_keys)
        x_keys = list(all_selected_lines)
        if "" in x_keys:
            x_keys.remove("")
            x_keys.append("X")
            current_chart = current_chart.replace("PLACEHOLDER_X_LABEL", "(X: no comment required)")
        else:
            current_chart = current_chart.replace("PLACEHOLDER_X_LABEL", "")
        current_chart = current_chart.replace("PLACEHOLDER_X_COORDS", ",".join(x_keys))
        current_chart = current_chart.replace("PLACEHOLDER_Y_MAX", str(answer_count))
        user_values = []
        algorithm_values = []
        for line in all_selected_lines:
            if line in algorithm_line_selection_counts:
                count = algorithm_line_selection_counts[line]
                algorithm_values.append("(" + str(line) + "," + str(count) + ")")
            elif line in user_line_selection_counts:
                count = len(user_line_selection_counts[line])
                if line == "":
                    line = "X"
                user_values.append("(" + str(line) + "," + str(count) + ")")
        current_chart = current_chart.replace("PLACEHOLDER_USER_VALUES", ("\n" + " " * 20).join(user_values))
        current_chart = current_chart.replace("PLACEHOLDER_ALGORITHM_VALUES", ("\n" + " " * 20).join(algorithm_values))
        result.append(current_chart)
    return result


def calculate_agreement(matched_answers, total_submission_count):
    avg_agreement = 0
    avg_agreement_without_first = 0
    all_count = 0
    without_first_count = 0
    for question, matched_lines in matched_answers.iteritems():
        is_first = True
        for line in sorted(matched_lines.keys(), key=natural_keys):
            avg_agreement += matched_lines[line] / float(total_submission_count)
            all_count += 1
            if is_first:
                is_first = False
                continue
            avg_agreement_without_first += matched_lines[line] / float(total_submission_count)
            without_first_count += 1
    if all_count > 0:
        avg_agreement = avg_agreement / float(all_count)
    if without_first_count > 0:
        avg_agreement_without_first = avg_agreement_without_first / float(without_first_count)
    return (avg_agreement, avg_agreement_without_first)


def matches_next_item_fuzzily(current_item, items):
    if current_item not in items:
        return False
    current_index = items.index(current_item)
    if current_index >= len(items) - 1:
        return False
    next_item = items[current_index + 1]
    return int(next_item) - int(current_item) <= 2


def match_predicitons(algorithm_predicitons, user_answers):
    matches = {}
    fuzzy_matches= {}
    for question, predicted_lines in algorithm_predicitons.iteritems():
        line_users = user_answers.get(question)
        if not line_users:
            continue
        matched_line_counts = {}
        fuzzy_matched_line_counts = {}
        for predicted_line in predicted_lines:
            matched_line_counts[predicted_line] = len(line_users.get(predicted_line, []))
            fuzzy_matched_line_counts[predicted_line] = 0
            already_counted_users = set()
            for fuzzy_line in range(int(predicted_line) - 1, int(predicted_line) + 2):
                if fuzzy_line > int(predicted_line) and matches_next_item_fuzzily(predicted_line, predicted_lines):
                    continue
                users_that_selected_line = line_users.get(str(fuzzy_line), [])
                for user in users_that_selected_line:
                    if user in already_counted_users:
                        continue
                    fuzzy_matched_line_counts[predicted_line] += 1
                    already_counted_users.add(user)
        matches[question] = matched_line_counts
        fuzzy_matches[question] = fuzzy_matched_line_counts
    return matches, fuzzy_matches


if __name__ == "__main__":
    # mapping from question name to identifier, e.g., "Question 11" => "marked1"
    QUESTION_NAMES = {"Question " + str(x): "q" + str(x) for x in range(1, 11)}
    QUESTION_NAMES.update({"Question " + str(x + 10): "marked" + str(x) for x in range(1, 11)})
    # QUESTION_NAMES = {"Question " + str(x + 10): "marked" + str(x) for x in range(1, 11)}
    TYPESCRIPT_DEVS_ONLY = True

    filenames = []
    with open("filenames.txt") as filenames_file:
        filenames = filenames_file.read().split("\n")

    csv_filename, prediction_filename, chart_template_filename, chart_output_filename, selection_lines_filename = filenames

    algorithm_selection_to_line = json.load(open(selection_lines_filename))
    print "Loading answers from '" + path.basename(csv_filename) + "'..."
    answers, submission_count = load_answers(csv_filename, TYPESCRIPT_DEVS_ONLY)
    print "Done."

    print "Loading and matching prediction data from '" + path.basename(prediction_filename) + "'..."
    predictions = json.load(open(prediction_filename))
    matched_predictions, fuzzy_matched_predictions = match_predicitons(predictions, answers)

    print "Done."

    print "Generating charts based on template '" + path.basename(chart_template_filename) + "'..."
    all_charts = generate_charts(QUESTION_NAMES, answers, matched_predictions,
                                 chart_template_filename, submission_count, algorithm_selection_to_line)
    with open(chart_output_filename, "w") as chart_file:
        print "Writing generated charts to '" + path.basename(chart_output_filename) + "'..."
        chart_file.write("\n\n".join(all_charts))
    print "Done."

    print "Calculating average agreement..."
    avg_agreement, avg_agreement_without_header = calculate_agreement(matched_predictions, submission_count)
    fuzzy_avg_agreement, fuzzy_avg_agreement_without_header = calculate_agreement(fuzzy_matched_predictions, submission_count)
    print "Done."

    print "Average agreement: " + str(avg_agreement)
    print "Average agreement (skipping first): " + str(avg_agreement_without_header)

    print "Average agreement (fuzzy): " + str(fuzzy_avg_agreement)
    print "Average agreement (fuzzy, skipping first): " + str(fuzzy_avg_agreement_without_header)

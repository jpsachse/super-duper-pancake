import csv
import json
import re
from natural_keys import natural_keys
from itertools import groupby
from os import path
from collections import Iterable
from itertools import chain


class QuestionAnswers:
    noTypeScript = 'I have never written or read TypeScript before'
    noProgramming = 'I have never written a software program before'


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
            user_id += 1
            if only_typescript_developers and no_typescript_no_programming(row):
                continue
            for question_id, question_column in questions.iteritems():
                selected_lines = re.sub(r"\s+", "", row[question_column]).split(",")
                lines_to_user = {line: user_id for line in selected_lines}
                question_answers = merge(result.get(question_id, {}), lines_to_user)
                result[question_id] = question_answers
    return (result, user_id)  # using the user_id as count


def generate_charts(question_names, question_line_match_counts, template_filename, answer_count):
    class ChartLabels:
        xAxisFreeQuestions = "Line Numbers of Locations Requiring Additional Comment"
        xAxisPreFilledQuestions = "Highlighted Locations Requiring Additional Comment"

    result = []
    template = ""
    with open(template_filename) as template_file:
        template = template_file.read()

    for question_name in sorted(question_names.iterkeys(), key=natural_keys):
        question_identifier = question_names[question_name]
        line_match_counts = question_line_match_counts[question_identifier]
        current_chart = template
        survey_image_path = "survey_images/"
        if question_identifier.startswith("q"):
            survey_image_path += "01_unmarked/"
            current_chart = current_chart.replace("PLACEHOLDER_X_LABEL", ChartLabels.xAxisFreeQuestions)
        else:
            survey_image_path += "02_marked/"
            current_chart = current_chart.replace("PLACEHOLDER_X_LABEL", ChartLabels.xAxisPreFilledQuestions)
        survey_image_path += question_identifier + ".png"
        current_chart = current_chart.replace("PLACEHOLDER_SURVEY_IMAGE", survey_image_path)
        current_chart = current_chart.replace("PLACEHOLDER_CAPTION", question_name)
        current_chart = current_chart.replace("PLACEHOLDER_LABEL", "fig:" + question_identifier)
        x_keys = ",".join(sorted(line_match_counts.keys(), key=natural_keys))
        current_chart = current_chart.replace("PLACEHOLDER_X_COORDS", x_keys)
        current_chart = current_chart.replace("PLACEHOLDER_Y_MAX", str(answer_count))
        values = []
        for line in sorted(line_match_counts.keys(), key=natural_keys):
            count = line_match_counts[line]
            values.append("(" + str(line) + "," + str(count) + ")")
        current_chart = current_chart.replace("PLACEHOLDER_VALUES", ("\n" + " " * 16).join(values))
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
    avg_agreement = avg_agreement / float(all_count)
    avg_agreement_without_header = avg_agreement_without_first / float(without_first_count)
    return (avg_agreement, avg_agreement_without_header)


# mapping from question name to identifier, e.g., "Question 11" => "marked1"
QUESTION_NAMES = {"Question " + str(x): "q" + str(x) for x in range(1, 11)}
QUESTION_NAMES.update({"Question " + str(x + 10): "marked" + str(x) for x in range(1, 11)})

filenames = []
with open("filenames.txt") as filenames_file:
    filenames = filenames_file.read().split("\n")

csv_filename, prediction_filename, chart_template_filename, chart_output_filename = filenames

print "Loading answers from '" + path.basename(csv_filename) + "'..."
answers, submission_count = load_answers(csv_filename, False)
print "Done."

print "Loading and matching prediction data from '" + path.basename(prediction_filename) + "'..."
matched_predictions = {}
fuzzy_matched_predictions = {}
predictions = json.load(open(prediction_filename))
for question, predicted_lines in predictions.iteritems():
    line_users = answers[question]
    matched_line_count = {}
    fuzzy_matched_line_count = {}
    for predicted_line in predicted_lines:
        matched_line_count[predicted_line] = len(line_users.get(predicted_line, []))
        fuzzy_matched_line_count[predicted_line] = 0
        already_counted_users = set()
        for fuzzy_line in range(int(predicted_line) - 1, int(predicted_line) + 2):
            users_that_selected_line = line_users.get(str(fuzzy_line), [])
            for user in users_that_selected_line:
                if user in already_counted_users:
                    continue
                fuzzy_matched_line_count[predicted_line] += 1
                already_counted_users.add(user)
    matched_predictions[question] = matched_line_count
    fuzzy_matched_predictions[question] = fuzzy_matched_line_count
print "Done."

print "Generating charts based on template '" + path.basename(chart_template_filename) + "'..."
all_charts = generate_charts(QUESTION_NAMES, matched_predictions, chart_template_filename, submission_count)
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

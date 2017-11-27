import csv
import json
import re
from natural_keys import natural_keys
from itertools import groupby
from os import path


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


def load_answers(filename, only_typescript_developers):
    result = {}
    number_of_counted_answers = 0
    with open(filename) as opened_file:
        reader = csv.reader(opened_file, delimiter=';', quotechar='"')
        questions = {k: v for k, v in vars(QuestionColumns).iteritems() if not k.startswith("__")}

        # get all answers as list, accessible by question identifier
        next(reader)  # skip the header
        next(reader)  # skip the first entry, as it's completely empty
        for row in reader:
            number_of_counted_answers += 1
            if only_typescript_developers and no_typescript_no_programming(row):
                continue
            for question_id, question_column in questions.iteritems():
                question_answers = result.get(question_id, [])
                current_answer = re.sub(r"\s+", "", row[question_column]).split(",")
                question_answers += current_answer
                result[question_id] = question_answers

        # group answers by line
        for question, answer_list in result.iteritems():
            sorted_answers = sorted([a for a in answer_list])
            # grouped_answers = [[answer, len(list(group))] for answer, group in groupby(sorted_answers)]
            # grouped_answers.sort(lambda a, b: b[1] - a[1])
            grouped_answers = {answer: len(list(group)) for answer, group in groupby(sorted_answers)}
            result[question] = grouped_answers
    return (result, number_of_counted_answers)


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
predictions = json.load(open(prediction_filename))
for question, predicted_lines in predictions.iteritems():
    answer_lines = answers[question]
    matched_lines = {}
    for predicted_line in predicted_lines:
        matched_lines[predicted_line] = answer_lines.get(predicted_line, 0)
    matched_predictions[question] = matched_lines
print "Done."

print "Generating charts based on template '" + path.basename(chart_template_filename) + "'..."
all_charts = generate_charts(QUESTION_NAMES, matched_predictions, chart_template_filename, submission_count)
with open(chart_output_filename, "w") as chart_file:
    print "Writing generated charts to '" + path.basename(chart_output_filename) + "'..."
    chart_file.write("\n\n".join(all_charts))
print "Done."


print "Calculating average agreement..."
avg_agreement = 0
avg_agreement_without_first = 0
all_count = 0
without_first_count = 0
for question, matched_lines in matched_predictions.iteritems():
    is_first = True
    for line in sorted(matched_lines.keys(), key=natural_keys):
        avg_agreement += matched_lines[line] / float(submission_count)
        all_count += 1
        if is_first:
            is_first = False
            continue
        avg_agreement_without_first += matched_lines[line] / float(submission_count)
        without_first_count += 1
avg_agreement = avg_agreement / float(all_count)
avg_agreement_without_header = avg_agreement_without_first / float(without_first_count)
print "Done."

print "Average agreement: " + str(avg_agreement)
print "Average agreement (skipping first): " + str(avg_agreement_without_header)

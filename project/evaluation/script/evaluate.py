import csv
import json
import re
from natural_keys import natural_keys
from itertools import groupby


class QuestionAnswers:
    noTypeScript = 'I have never written or read TypeScript before'
    noProgramming = 'I have never written a software program before'


class QuestionColumns:
    experienceProgramming = 3
    experienceTypeScript = 4
    q1, q2, q3, q4, q5, q6, q7, q8, q9, q10 = range(7, 17)
    marked1, marked1a, marked2, marked2a, marked3, marked3a, marked4, marked4a, marked5, marked5a, marked6,\
        marked6a, marked7, marked7a, marked8, marked8a, marked9, marked9a, marked10, marked10a = range(17, 37)

class ChartLabels:
    xAxisFreeQuestions = "Comment Requirement Location Line Numbers"
    xAxisPreFilledQuestions = "Highlighted Comment Requirement Locations"

# mapping from question name to identifier, e.g., "Question 11" => "marked1"
QUESTION_NAMES = {"Question " + str(x): "q" + str(x) for x in range(1, 11)}
QUESTION_NAMES.update({"Question " + str(x + 10): "marked" + str(x) for x in range(1, 11)})
TS_DEVS_ONLY = False

filenames = []
with open("filenames.txt") as filenames_file:
    filenames = filenames_file.read().split("\n")

csv_filename, prediction_filename, chart_template_filename, chart_output_filename = filenames

answers = {}
with open(csv_filename) as opened_file:
    reader = csv.reader(opened_file, delimiter=';', quotechar='"')
    questions = {k: v for k, v in vars(QuestionColumns).iteritems() if not k.startswith("__")}

    # get all answers as list, accessible by question
    next(reader)  # skip the header
    for row in reader:
        if TS_DEVS_ONLY and (row[QuestionColumns.experienceTypeScript] == QuestionAnswers.noTypeScript or
                row[QuestionColumns.experienceProgramming] == QuestionAnswers.noProgramming):
            continue
        for question, question_column in questions.iteritems():
            question_answers = answers.get(question, [])
            current_answer = re.sub(r"\s+", "", row[question_column]).split(",")
            question_answers += current_answer
            answers[question] = question_answers

    # group answers by line
    for question, answer_list in answers.iteritems():
        sorted_answers = sorted([a for a in answer_list])
        # grouped_answers = [[answer, len(list(group))] for answer, group in groupby(sorted_answers)]
        # grouped_answers.sort(lambda a, b: b[1] - a[1])
        grouped_answers = { answer: len(list(group)) for answer, group in groupby(sorted_answers) }
        answers[question] = grouped_answers

matched_predictions = {}
predictions = json.load(open(prediction_filename))
for question, predicted_lines in predictions.iteritems():
    answer_lines = answers[question]
    matched_lines = {}
    for predicted_line in predicted_lines:
        matched_lines[predicted_line] = answer_lines.get(predicted_line, 0)
    matched_predictions[question] = matched_lines

chart_template = ""
with open(chart_template_filename) as chart_template_file:
    chart_template = chart_template_file.read()

all_charts = []
for question_name in sorted(QUESTION_NAMES.iterkeys(), key=natural_keys):
    question_identifier = QUESTION_NAMES[question_name]
    matched_prediction = matched_predictions[question_identifier]
    current_chart = chart_template
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
    current_chart = current_chart.replace("PLACEHOLDER_LABEL", "fig:" + question)
    x_keys = ",".join(sorted(matched_prediction.keys(), key=natural_keys))
    current_chart = current_chart.replace("PLACEHOLDER_X_COORDS", x_keys)

    values = []
    for line in sorted(matched_prediction.keys(), key=natural_keys):
        count = matched_prediction[line]
        values.append("(" + str(line) + "," + str(count) + ")")
    current_chart = current_chart.replace("PLACEHOLDER_VALUES", ("\n" + " " * 16).join(values))
    all_charts.append(current_chart)

with open(chart_output_filename, "w") as chart_file:
    chart_file.write("\n\n".join(all_charts))
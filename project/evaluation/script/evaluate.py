import csv
import json
import re
from pprint import pprint
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
for question, matched_prediction in matched_predictions.iteritems():
    current_chart = chart_template
    current_chart = current_chart.replace("PLACEHOLDER_CAPTION", question)
    current_chart = current_chart.replace("PLACEHOLDER_LABEL", "fig:" + question)
    x_keys = ",".join(sorted(matched_prediction.keys()))
    current_chart = current_chart.replace("PLACEHOLDER_X_COORDS", x_keys)
    values = ["(" + str(line) + "," + str(count) + ")" for line, count in matched_prediction.iteritems()]
    current_chart = current_chart.replace("PLACEHOLDER_VALUES", "\n".join(values))
    all_charts.append(current_chart)

with open(chart_output_filename, "w") as chart_file:
    chart_file.write("\n".join(all_charts))
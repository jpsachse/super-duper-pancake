## Project for the Thesis "Evaluating Source Code Complexity and Comment Quality using TSLint"

### Setup

NPM needs to be installed.
Open the project folder in the command line of your choice and run `npm install`.

### Usage

Open the project with Visual Studio Code and build it.
Then, open the project where you want to use the TSLint rule and add `"high-comment-quality": true` to your rules dictionary.
Finally, add the path to the built project to your `rulesDirectory` array, e.g.:
```
    "rulesDirectory": [
        "/Users/<USER>/highCommentQualityRule/project"
    ]
```

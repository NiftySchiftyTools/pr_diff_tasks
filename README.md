### Pull Request Diff Tasks

Pull Request Diff Tasks is a github action that will read various yaml files throughout the repo and perform various actions, on Pull Requests based on the diff of the PR. This is accomplished by defining "domain guard" or (\*.dg) files across the repo that the action can read and perform small tasks on the PR that triggers the configured guards. The various actions include:

- Requesting reviews from Repo Collaborators and Teams
- Adding collaborators as Assignees
- Add an automated comment to a file in the Pull Request
- Assigning a User to the PR
- Attaching a label to the PR

This is accomplished by the structures in files with the .dg extension.

A structure has the following options, anything extra will be ignored but must be a valid yaml:

```yaml
STRUCT_NAME_CAN_BE_ANYTHING:
  # List of filepath wildcards that trigger the actions in the struct
  # If not provided this matches all changes in the current directory and below
  paths: []
  # Filters for the structures triggers
  filters:
    # Regular Expression to match to the PR diff
    diff_regex: ".*"
    # Matching Behaviour of the struct
    #  - all: always matches (DEFAULT if left empty or with unsupported value)
    #  - last_match: Will only match if this structure is the deepest structure
    #                to match the file in question.
    quirk: all
    # Part of the diff to attempt to match with the 'diff_regex' filter's regex
    #  - all: all lines with a diff (DEFAULT if left empty or with unsupported value)
    #  - additions: only file additions
    #  - removals: only file removals
    #  - raw: full raw diff(does not remove the context lines, not recommended)
    diff_type: all
    # List of filepath wildcards that are exceptions to the path wildcards
    exclude_paths: []
  # Actions that are done when the struct is triggered
  actions:
    # List of strings to post as comments when files trigger the struct
    comments: []
    # List of Collaborators to request reviews from when struct is triggered
    reviewers: []
    # List of Collaborators to assign PR to when struct is triggered (limit 10 total)
    assignees: []
    # List of Github Teams to request reviews from
    teams: []
    # List of labels to attach to the PR
    labels: []
```

be sure to add the following to your `.vscode/settings.json` to use your yaml extension for \*.dg files:

```json
{
  "files.associations": {
    "*.dg": "yaml"
  }
}
```

You can have as many as you'd like in each file, and as many .dg files as you'd like throughout the repo. Directory placement is important to consider when defining a struct. the `paths` and `exclude_paths` values are relative to the current directory of the file. Also when using `last_match` it will determine under what conditions the match is iagnored.

Quirk value `last_match` behaves in a way that will only match if it is the deepest dg file that contains a struct that was matched for a given file. for example supposed the following 2 files exist:

`top_level.dg`

```yaml
top_level_struct:
  paths: ["subdirectory/*.txt"]
  filters:
    quirk: last_match
  actions:
    comments: ["Hello from the top_level"]
```

`subdirectory/bottom_level.dg`

```yaml
bottom_level_struct:
  paths: ["file1.txt"]
  filters:
    quirk: last_match
  actions:
    comments: ["Hello from the bottom_level"]
```

and The PR diff was in file at `subdirectory/file1.txt`, then only the `bottom_level_struct` will be triggered since it is in a deeper directory of the repo. But the `top_level_struct` would still be triggered if there was a change to a file at `subdirectory/file2.txt` since it wouldn't match the `bottom_level_struct`.

Action values that are not valid such as a invalid team name, label, github user that is not a collaborator on the repo, etc. Will result in a warning log but will not stop the action.

Another unique behaviour will come up as a result of a technical limitation in Github. Only 10 people can be assigned to a PR. So this will always behave similiar to the `last_match` quirk value, in that it will only ever assign up to the last 10 people marked for assignment.

#### Using the Action

Currently there isn't much to set on the workflow level since the majority of the functionality is controlled via the dg files throughout the repo. However I am open to suggestions for global config options that could be controlled here. Here is the basic structure you will need though:

```yaml
name: PR Diff Tasks Example and Test Workflow

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  issues: write
  actions: read
  pull-requests: write

jobs:
  pr_diff_tasks:
    runs-on: ubuntu-latest
    steps:
      - name: Run PR Diff Tasks Action
        uses: NiftySchiftyTools/pr_diff_tasks@main
        with:
          github_token: ${{ github.token }}
          pr_number: ${{ github.event.pull_request.number }}
```

You will run into some errors if the token doesn't have the right permissions set. Inputs include:

```yaml
github_token: REQUIRED. token for the action to give permission to the action to perform its tasks on the PRs
pr_number: REQUIRED. PR to check in the workflow
```

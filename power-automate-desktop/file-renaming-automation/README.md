# Power Automate Desktop: Structured File Renaming

A Power Automate Desktop (PAD) flow that renames files automatically based on structured data contained in their filenames. It extracts the relevant parts of each filename, applies rules to build the new name, and logs the outcome of every file it processes.

> **Status:** Built and tested with both success and failure cases.

---

## Overview

Manually renaming large batches of files is slow and error-prone. This flow automates the process by reading the structured information already present in each filename, rebuilding the name in a consistent format, and recording what happened so the results can be reviewed.

## What It Does

- Reads files from a source folder
- Extracts structured data from each filename using text extraction
- Checks each file against conditions to decide whether it can be renamed
- Renames valid files using the extracted data
- Handles errors without stopping the whole run
- Writes a log of the outcome for each file

## Key Concepts Demonstrated

| Concept | How it is used |
|---------|----------------|
| **Loops** | Processes each file in the folder one at a time |
| **Conditions** | Validates filenames and decides whether to rename or skip |
| **Text extraction** | Pulls structured values out of the original filename |
| **Error handling** | Catches failures so one bad file does not stop the flow |
| **Logging** | Records the result for each file for later review |

## How It Works

1. **Load files.** The flow retrieves the list of files from the source folder.
2. **Loop through files.** Each file is handled individually.
3. **Extract data.** Text actions parse the filename into its structured parts.
4. **Validate.** Conditions check that the expected data is present and usable.
5. **Rename or skip.** Valid files are renamed; invalid files are skipped and flagged.
6. **Handle errors.** If an action fails, the error is captured and the flow continues with the next file.
7. **Log results.** Each file's outcome is written to the log.

<!-- Optional: add a flow diagram or screenshot of the PAD flow here. -->

## Testing

The flow was tested with both success and failure cases.

- **Success cases:** files with correctly structured names were renamed as expected.
- **Failure cases:** files that did not match the expected structure or could not be renamed were handled by the error handling logic and recorded in the log rather than crashing the flow.

<!-- Optional: add the specific test scenarios you ran (e.g. missing field, duplicate target name, locked file) once you want them listed. Only include what you actually tested. -->

## Tools Used

- Microsoft Power Automate Desktop

## Setup and Usage

<!-- Add these details before sharing the project publicly:
- Expected filename format (with a fictional example)
- Source and destination folder settings
- Where the log file is written
- Steps to import and run the flow
-->

## Artifacts

The flow export and a screenshot of the flow will be added to this folder when available. They are not included yet.

## Limitations

- Built for a specific structured filename format. Different formats would require changes to the extraction and validation steps.

## What I Would Improve Next

<!-- Add your own planned improvements here, if any. -->

---

[Back to portfolio](../../README.md)

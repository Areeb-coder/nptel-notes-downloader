# NPTEL Notes Downloader

A lightweight browser-console utility for downloading lecture-note PDFs from NPTEL course pages.

It identifies the **Lecture Notes** entries in a course's week sidebar, opens those entries one at a time, looks for the course-provided download link or an accessible Google Drive viewer reference, and asks the browser to download the corresponding file with a week-based filename.

> This repository contains a small utility for a browser workflow. It is not an official NPTEL, SWAYAM, or Google product.

## Scope

The utility is intentionally limited to lecture notes. It does not visit ordinary lecture/video pages or attempt to download assignments, quizzes, feedback pages, or course videos.

Supported sidebar labels include:

- `Week 1: Lecture Notes`
- `Week 4: Lecture Notes`
- `Lecture Note_1 for Week 8`
- `Lecture Note_2 for Week 8`

## Requirements

- Desktop Google Chrome or another Chromium-based browser.
- Access to the relevant NPTEL course.
- An active course login session, if required.
- Permission to access the linked Google Drive files.

## How to use

### 1. Open the NPTEL course

Sign in and open the course learning page that displays the week and lesson sidebar.

Wait for the course interface to finish loading. Scroll the sidebar through the course if later weeks have not yet loaded into the page.

### 2. Open the browser Console

Press `F12` or `Ctrl + Shift + J` and select **Console**.

Chrome may show a paste-protection warning. Follow the browser's instructions and only paste code you have reviewed.

### 3. Copy and run the utility

Open [`nptel-notes-downloader.js`](./nptel-notes-downloader.js), copy its complete contents, paste it into the Console, and press Enter.

The utility prints a table of matching Notes entries and processes them sequentially. It targets only entries labelled **Lecture Notes**.

### 4. Allow multiple downloads

Chrome may ask whether the NPTEL site can download multiple files. Choose **Allow** so subsequent files can be downloaded.

Keep the NPTEL course tab open while the utility runs. Do not manually navigate or click other lessons during processing.

### 5. Check downloaded files

Open Chrome Downloads with `Ctrl + J`.

Example filenames:

```text
NPTEL - Week 1 - Lecture Notes.pdf
NPTEL - Week 4 - Lecture Notes.pdf
NPTEL - Week 8 - Lecture Note_1 for Week 8.pdf
NPTEL - Week 8 - Lecture Note_2 for Week 8.pdf
```

The browser or Google Drive may adjust a filename based on download response headers or duplicate-file handling.

## How it works

1. Finds the course sidebar.
2. Collects sidebar labels matching the supported Lecture Notes patterns.
3. Clicks each matching entry, without intentionally opening ordinary lecture rows.
4. Looks for the visible NPTEL download link and accessible embedded Google Drive references.
5. Extracts a Drive file ID when it is exposed.
6. Starts a browser download using the Google Drive download endpoint.
7. Prints a summary of download requests and failures.

## Troubleshooting

### No Notes entries are detected

- Confirm that the current tab is the NPTEL course learning page.
- Wait for the sidebar to render.
- Scroll the sidebar so the relevant week entries are loaded.
- Run the utility again.

### A Notes page opens but no download is requested

Some course pages expose notes through an embedded PDF viewer rather than a normal download link. A top-right open/external control may open the viewer in a separate Google Drive page.

A script running on the NPTEL domain cannot inspect the contents of a cross-origin Google Drive page or iframe. If the final Drive file URL is not exposed by the NPTEL page, download that item manually using the viewer's open/download controls.

### Google Drive asks for access

The utility does not grant access or bypass Drive permissions. Sign in with an account that has permission to view and download the file, or follow the course provider's access instructions.

### Chrome blocks automatic downloads

Review Chrome's site settings for the NPTEL domain and allow multiple/automatic downloads. The exact setting label may differ by Chrome version.

## Limitations

- The utility relies on the current NPTEL sidebar labels and page structure. Site changes may require updates.
- Google Drive links must be accessible to the signed-in user.
- Cross-origin browser security may prevent inspection of a final URL inside an embedded Drive viewer.
- The script triggers downloads through Chrome; it does not create folders on the computer or guarantee that every download completed successfully.
- This utility does not bypass access controls, quotas, copyright restrictions, or other download limitations.

## Responsible use

Use the utility only for course material you are authorised to access and download. Follow NPTEL/SWAYAM terms, course-provider instructions, Google Drive permissions, and applicable copyright rules. Do not redistribute downloaded material without permission from the rights holder.

## Compatibility

Designed for the NPTEL course interface observed during development and tested manually against the browser workflow described in the documentation. It is not affiliated with or endorsed by NPTEL, SWAYAM, or Google.

## License

No license has been added. Unless a license file is provided, all rights are reserved by the repository owner.

# NPTEL Notes & Assignment Solutions Downloader

A lightweight browser-console utility for downloading lecture-note and assignment-solution PDFs from NPTEL course pages.

When run, the utility asks which material to download:

1. **Lecture Notes**
2. **Assignment Solutions**

It then scans the course sidebar for only the selected category, opens matching entries sequentially, looks for the course-provided download link or an accessible Google Drive viewer reference, and asks the browser to download the corresponding files with week-based filenames.

> This repository contains a small browser utility. It is not an official NPTEL, SWAYAM, or Google product.

## Supported download categories

### Lecture Notes

Recognised sidebar labels include:

- `Week 1: Lecture Notes`
- `Week 4: Lecture Notes`
- `Lecture Note_1 for Week 8`
- `Lecture Note_2 for Week 8`

### Assignment Solutions

Recognised sidebar labels include:

- `Week 1: Assignment 1 Solution`
- `Week 4: Assignment 4 solution`
- `Week 8: Assignment 8 Solution`

Matching is case-insensitive. Ordinary lecture/video, quiz, feedback, and non-solution assignment entries are ignored.

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

A selection prompt will appear:

- Enter `1` for **Lecture Notes**.
- Enter `2` for **Assignment Solutions**.
- Press **Cancel** to stop without opening any course entries.

The utility lists the matching sidebar entries and processes them sequentially. It does not intentionally open other lesson types.

### 4. Allow multiple downloads

Chrome may ask whether the NPTEL site can download multiple files. Choose **Allow** so subsequent files can be downloaded.

Keep the NPTEL course tab open while the utility runs. Do not manually navigate or click other lessons during processing.

### 5. Check downloaded files

Open Chrome Downloads with `Ctrl + J`.

Example filenames for Lecture Notes:

```text
NPTEL - Week 1 - Lecture Notes.pdf
NPTEL - Week 4 - Lecture Notes.pdf
NPTEL - Week 8 - Lecture Note_1 for Week 8.pdf
NPTEL - Week 8 - Lecture Note_2 for Week 8.pdf
```

Example filenames for Assignment Solutions:

```text
NPTEL - Week 1 - Assignment 1 Solution.pdf
NPTEL - Week 4 - Assignment 4 solution.pdf
NPTEL - Week 8 - Assignment 8 Solution.pdf
```

The browser or Google Drive may adjust a filename based on download response headers or duplicate-file handling.

## How it works

1. Prompts for the requested download category.
2. Finds the course sidebar and collects only labels matching that category.
3. Clicks each matching entry, without intentionally opening ordinary lecture or unrelated sidebar rows.
4. Looks for the visible NPTEL download link and accessible embedded Google Drive references.
5. If the embedded viewer exposes an open/external control, attempts to capture the URL opened by that control.
6. Extracts a Drive file ID when it is exposed.
7. Starts a browser download using the Google Drive download endpoint.
8. Prints a summary of download requests and failures.

## Troubleshooting

### No matching entries are detected

- Confirm that the current tab is the NPTEL course learning page.
- Check that the sidebar uses one of the supported labels listed above.
- Wait for the sidebar to render and scroll so the relevant weeks are loaded.
- Run the utility again and select the appropriate category.

### A page opens but no download is requested

Some course pages expose files through an embedded viewer rather than a normal download link. A top-right open/external control may open the viewer in a separate Google Drive page.

The utility checks for accessible viewer references and attempts to capture a URL when an open/external control calls the page's `window.open()`. A script running on the NPTEL domain cannot inspect the contents of a cross-origin Google Drive page or iframe. If the viewer opens through a mechanism the page script cannot observe, download that item manually using the viewer's open/download controls.

### Google Drive asks for access

The utility does not grant access or bypass Drive permissions. Sign in with an account that has permission to view and download the file, or follow the course provider's access instructions.

### Chrome blocks automatic downloads

Review Chrome's site settings for the NPTEL domain and allow multiple/automatic downloads. The exact setting label may differ by Chrome version.

## Limitations

- The utility relies on the current NPTEL sidebar labels and page structure. Site changes may require updates.
- It only selects entries matching the chosen category; courses using different wording may need a pattern update.
- Google Drive links must be accessible to the signed-in user.
- Cross-origin browser security may prevent inspection of a final URL inside an embedded Drive viewer.
- The script triggers downloads through Chrome; it does not create folders on the computer or guarantee that every download completed successfully.
- This utility does not bypass access controls, quotas, copyright restrictions, or other download limitations.

## Responsible use

Use the utility only for course material you are authorised to access and download. Follow NPTEL/SWAYAM terms, course-provider instructions, Google Drive permissions, and applicable copyright rules. Do not redistribute downloaded material without permission from the rights holder.

## Compatibility

Designed for the NPTEL course interface observed during development. It is not affiliated with or endorsed by NPTEL, SWAYAM, or Google.

## License

No license has been added. Unless a license is provided, all rights are reserved by the repository owner.

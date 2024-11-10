// Import necessary modules
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const archiver = require('archiver');

const filesystem = require('fs').promises;
const util = require('util');

// Create an Express app
const app = express();

// Set up the port
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'converter.html'));
});

// Handle file uploads
app.post('/convert', upload.single('file'), (req, res) => {
    const file = req.file;
    const fileExt = path.extname(file.originalname).toLowerCase();

    // Move the file to the uploads directory
    const uploadPath = path.join(__dirname, 'uploads', file.originalname);
    fs.renameSync(file.path, uploadPath);

    // Check the file extension and run the appropriate function
    if (fileExt === '.cdm') {
        createIMSCCFile();
        res.send('CADMOS -> CANVAS');
    } else if (fileExt === '.imscc') {
        convertIMSCC();
        res.send('CANVAS -> CADMOS');
    } else {
        // Delete the uploaded file if the format is wrong
        fs.unlinkSync(uploadPath);
        res.send('<script>alert("Wrong file format"); window.location.href = "/";</script>');
    }
});

// ############################ CADMOS -> CANVAS ##############################


function createWebResourcesFolder() {
    const uploadsFolderPath = path.join(__dirname, "uploads");
    const webResourcesFolderPath = path.join(uploadsFolderPath, "web_resources");

    try {
        // Check if the "web_resources" folder already exists
        if (!fs.existsSync(webResourcesFolderPath)) {
            // Create the "web_resources" folder
            fs.mkdirSync(webResourcesFolderPath);
            console.log("web_resources folder created successfully!");
        } else {
            console.log("web_resources folder already exists.");
        }
    } catch (error) {
        console.error("Error creating web_resources folder:", error);
    }
}

async function moveFilesToWebResources() {
    const uploadsFolderPath = path.join(__dirname, "uploads");
    const webResourcesFolderPath = path.join(uploadsFolderPath, "web_resources");

    try {
        // Read the contents of the "uploads" folder
        const filesInUploads = await filesystem.readdir(uploadsFolderPath);

        // Files and folders to exclude
        const excludedFiles = [".cdm", "source.json", "web_resources"];

        // Filter out the excluded files and move the rest to "web_resources"
        for (const file of filesInUploads) {
            if (!excludedFiles.includes(file) && path.extname(file) !== ".cdm") {
                const sourceFilePath = path.join(uploadsFolderPath, file);
                const destinationFilePath = path.join(webResourcesFolderPath, file);

                try {
                    await filesystem.rename(sourceFilePath, destinationFilePath);
                    console.log(`Moved ${file} to web_resources/${file}`);
                } catch (error) {
                    console.error(`Error moving ${file}:`, error);
                }
            }
        }

        console.log("All files moved successfully!");
    } catch (error) {
        console.error("Error reading files in 'uploads' folder:", error);
    }
}

async function createXMLFiles() {
    const uploadsFolderPath = path.join(__dirname, 'uploads');

    // Content for imsmanifest.xml
    const imsManifestContent = `<manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource" xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id1" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lomresource_v1p0.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lommanifest_v1p0.xsd">
    <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
    <lomimscc:lom>
    <lomimscc:general>
    <lomimscc:title>
    <lomimscc:string>0</lomimscc:string>
    </lomimscc:title>
    </lomimscc:general>
    <lomimscc:lifeCycle>
    <lomimscc:contribute>
    <lomimscc:date>
    <lomimscc:dateTime>2023-10-24</lomimscc:dateTime>
    </lomimscc:date>
    </lomimscc:contribute>
    </lomimscc:lifeCycle>
    <lomimscc:rights>
    <lomimscc:copyrightAndOtherRestrictions>
    <lomimscc:value>yes</lomimscc:value>
    </lomimscc:copyrightAndOtherRestrictions>
    <lomimscc:description>
    <lomimscc:string>Private (Copyrighted) - http://en.wikipedia.org/wiki/Copyright</lomimscc:string>
    </lomimscc:description>
    </lomimscc:rights>
    </lomimscc:lom>
    </metadata>
    <organizations>
    <organization identifier="org_1" structure="rooted-hierarchy">
    <item identifier="LearningModules">
    </item>
    </organization>
    </organizations>
    <resources>
    <resource identifier="id5" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="course_settings/canvas_export.txt">
    <file href="course_settings/course_settings.xml"/>
    <file href="course_settings/module_meta.xml"/>
    <file href="course_settings/assignment_groups.xml"/>
    <file href="course_settings/files_meta.xml"/>
    <file href="course_settings/context.xml"/>
    <file href="course_settings/media_tracks.xml"/>
    <file href="course_settings/canvas_export.txt"/>
    </resource>
    </resources>
    </manifest>`;

    // Content for module_meta.xml
    const moduleMetaContent = `<modules xmlns="http://canvas.instructure.com/xsd/cccv1p0" 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 
    https://canvas.instructure.com/xsd/cccv1p0.xsd">
    </modules>`;

    const mediaTracksContent = '<media_tracks xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd"> </media_tracks>'

    const contextContent = `<context_info xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">
    <course_id>7996002</course_id>
    <course_name>test</course_name>
    <root_account_id>70000000000010</root_account_id>
    <root_account_name>Free for Teacher</root_account_name>
    <root_account_uuid>ff2e5780-fa5b-012d-f7b3-123135003972</root_account_uuid>
    <canvas_domain>canvas.instructure.com</canvas_domain>
    </context_info>`;

    const filesMetaContent = `<fileMeta xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd"> </fileMeta>`;

    const assignmentGroupsContent = `<assignmentGroups xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">
    <assignmentGroup identifier="id6">
    <title>Assignments</title>
    <position>1</position>
    <group_weight>0.0</group_weight>
    </assignmentGroup>
    </assignmentGroups>`;

    const courseSettingsContent = `<course xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id5" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">
    <title>test</title>
    <course_code>test</course_code>
    <start_at/>
    <conclude_at/>
    <is_public>false</is_public>
    <allow_student_wiki_edits>false</allow_student_wiki_edits>
    <allow_student_forum_attachments>true</allow_student_forum_attachments>
    <lock_all_announcements>false</lock_all_announcements>
    <default_wiki_editing_roles>teachers</default_wiki_editing_roles>
    <allow_student_organized_groups>true</allow_student_organized_groups>
    <default_view>modules</default_view>
    <open_enrollment>false</open_enrollment>
    <filter_speed_grader_by_student_group>false</filter_speed_grader_by_student_group>
    <self_enrollment>false</self_enrollment>
    <license>private</license>
    <hide_final_grade>false</hide_final_grade>
    <hide_distribution_graphs>false</hide_distribution_graphs>
    <allow_student_discussion_topics>true</allow_student_discussion_topics>
    <allow_student_discussion_editing>true</allow_student_discussion_editing>
    <show_announcements_on_home_page>false</show_announcements_on_home_page>
    <home_page_announcement_limit>3</home_page_announcement_limit>
    <usage_rights_required>false</usage_rights_required>
    <restrict_student_future_view>false</restrict_student_future_view>
    <restrict_student_past_view>false</restrict_student_past_view>
    <homeroom_course>false</homeroom_course>
    <grading_standard_enabled>false</grading_standard_enabled>
    <storage_quota>1572864000</storage_quota>
    <overridden_course_visibility/>
    <root_account_uuid>ff2e5780-fa5b-012d-f7b3-123135003972</root_account_uuid>
    <default_post_policy>
    <post_manually>false</post_manually>
    </default_post_policy>
    <allow_final_grade_override>false</allow_final_grade_override>
    </course>`;

    try {
        // Write content to imsmanifest.xml
        const imsManifestPath = path.join(uploadsFolderPath, 'imsmanifest.xml');
        filesystem.writeFile(imsManifestPath, imsManifestContent);
        console.log('imsmanifest.xml created successfully!');

        // Write content to module_meta.xml
        const moduleMetaPath = path.join(uploadsFolderPath, 'module_meta.xml');
        filesystem.writeFile(moduleMetaPath, moduleMetaContent);
        console.log('module_meta.xml created successfully!');

        // Write content to course_settings.xml
        const courseSettingsPath = path.join(uploadsFolderPath, 'course_settings.xml');
        filesystem.writeFile(courseSettingsPath, courseSettingsContent);
        console.log('course_settings.xml created successfully!');

        // Write content to assignment_groups.xml
        const assignmentGroupsPath = path.join(uploadsFolderPath, 'assignment_groups.xml');
        filesystem.writeFile(assignmentGroupsPath, assignmentGroupsContent);
        console.log('assignment_groups.xml created successfully!');

        // Write content to files_meta.xml
        const filesMetaPath = path.join(uploadsFolderPath, 'files_meta.xml');
        filesystem.writeFile(filesMetaPath, filesMetaContent);
        console.log('files_meta.xml created successfully!');

        // Write content to context.xml
        const contextPath = path.join(uploadsFolderPath, 'context.xml');
        filesystem.writeFile(contextPath, contextContent);
        console.log('context.xml created successfully!');

        // Write content to media_tracks.xml
        const mediaTracksPath = path.join(uploadsFolderPath, 'media_tracks.xml');
        filesystem.writeFile(mediaTracksPath, mediaTracksContent);
        console.log('media_tracks.xml created successfully!');
    } catch (error) {
        console.error('Error creating documents:', error);
    }
}

async function createConvertJson() {
    try {
        // Create an object with two empty arrays
        const data = {
            Topics: [],
            Activities: []
        };

        // Write the content to convert.json
        const convertFilePath = './uploads/convert.json';
        await filesystem.writeFile(convertFilePath, JSON.stringify(data, null, 2));

        console.log('convert.json file created successfully with empty arrays (Topics and Activities).');
    } catch (error) {
        console.error('Error creating convert.json file:', error.message);
    }
}

async function writeTopicsOnConvert() {
    try {
        // Read the content of source.json
        const sourceFilePath = './uploads/source.json';
        const sourceContent = await filesystem.readFile(sourceFilePath, 'utf-8');

        // Parse the JSON content
        const jsonData = JSON.parse(sourceContent);

        // Extract relevant data and create objects in Topics array
        const topicsArray = [];

        if (jsonData && jsonData.data && jsonData.data.Flow && jsonData.data.Flow.FlowSub) {
            const flowSubArray = jsonData.data.Flow.FlowSub;

            flowSubArray.forEach((flowSub, index) => {
                const topicName = flowSub.text;
                const moduleID = `M${index + 1}`;
                const topicTop = flowSub.top;

                // Create object and push it to Topics array
                const topicObject = {
                    topicName,
                    moduleID,
                    topicTop
                };

                topicsArray.push(topicObject);
            });
        }

        // Read existing convert.json content
        const convertFilePath = './uploads/convert.json';
        const convertContent = await filesystem.readFile(convertFilePath, 'utf-8');

        // Parse existing convert.json content
        const convertData = JSON.parse(convertContent);

        // Add the created objects to the Topics array in convert.json
        if (convertData && convertData.Topics) {
            convertData.Topics = topicsArray;
        } else {
            convertData.Topics = [];
        }

        // Write the updated content to convert.json
        await filesystem.writeFile(convertFilePath, JSON.stringify(convertData, null, 2));

        console.log('Topics added to convert.json successfully.');
    } catch (error) {
        console.error('Error writing Topics to convert.json:', error.message);
    }
}

async function writeActivitiesOnConvert() {
    try {
        // Read the content of source.json
        const sourceFilePath = './uploads/source.json';
        const sourceContent = await filesystem.readFile(sourceFilePath, 'utf-8');

        // Parse the JSON content
        const jsonData = JSON.parse(sourceContent);

        // Extract relevant data and create objects in activities array
        const activitiesArray = [];

        if (
            jsonData &&
            jsonData.data &&
            jsonData.data.Conceptual &&
            jsonData.data.Conceptual.ConceptualBase
        ) {
            const conceptualBaseArray = jsonData.data.Conceptual.ConceptualBase;

            conceptualBaseArray.forEach((conceptualBase, index) => {
                const children = conceptualBase.children || [];
                const modalData = children[0]?.ModalData || {};
                const title = modalData.Title || null;
                const resourceID = `R${index + 1}`;
                const fileID = `F${index + 1}`;
                const resourceLocation = modalData.ResourceLocation || null;

                // Ignore activities with null resourceLocation
                if (resourceLocation !== null) {
                    // Find corresponding object in Activities array
                    const correspondingActivity = findActivityById(
                        jsonData.data.Flow.FlowBase || [],
                        conceptualBase.id
                    );

                    // Get "top" value from the corresponding Activity
                    const activityTop = correspondingActivity ? correspondingActivity.top : null;

                    // Create object and push it to activities array
                    const activityObject = {
                        activityName: title,
                        resourceID,
                        fileID,
                        resourceLocation,
                        activityTop,
                    };

                    activitiesArray.push(activityObject);
                }
            });
        }

        // Read existing convert.json content
        const convertFilePath = './uploads/convert.json';
        const convertContent = await filesystem.readFile(convertFilePath, 'utf-8');

        // Parse existing convert.json content
        const convertData = JSON.parse(convertContent);

        // Add the created objects to the existing Activities array in convert.json
        if (convertData && convertData.Activities) {
            convertData.Activities = convertData.Activities.concat(activitiesArray);
        } else {
            convertData.Activities = activitiesArray;
        }

        // Write the updated content to convert.json
        await filesystem.writeFile(convertFilePath, JSON.stringify(convertData, null, 2));

        console.log('Activities added to convert.json successfully.');
    } catch (error) {
        console.error('Error writing Activities to convert.json:', error.message);
    }
}

// Function to find an activity by id in the FlowBase array
function findActivityById(flowBaseArray, targetId) {
    for (const flowBase of flowBaseArray) {
        if (flowBase.Activities) {
            const activity = flowBase.Activities.find((activity) => activity.id === targetId);
            if (activity) {
                return activity;
            }
        }
    }
    return null;
}

async function groupActivities() {
    try {
        // Read the content of convert.json
        const convertFilePath = './uploads/convert.json';
        const convertContent = await filesystem.readFile(convertFilePath, 'utf-8');

        // Parse the JSON content
        const convertData = JSON.parse(convertContent);

        // Extract Topics and Activities arrays from convert.json
        const topicsArray = convertData.Topics || [];
        let activitiesArray = convertData.Activities || [];

        // Iterate through each object in Topics array
        topicsArray.forEach((topic, index) => {
            const resourcesArray = [];

            // Compare activityTop values and move matching objects to resourcesArray
            activitiesArray = activitiesArray.filter((activity) => {
                const activityTop = activity.activityTop;
                const topicTop = topic.topicTop;
                const nextTopicTop = topicsArray[index + 1]?.topicTop;

                if (activityTop > topicTop && (nextTopicTop === undefined || activityTop < nextTopicTop)) {
                    resourcesArray.push(activity);
                    return false; // Remove the activity from the original array
                }

                return true; // Keep the activity in the original array
            });

            // Add the resources array to the current topic
            topic.resources = resourcesArray;
        });

        // Update convert.json with the modified data
        convertData.Activities = activitiesArray;
        await filesystem.writeFile(convertFilePath, JSON.stringify(convertData, null, 2));

        console.log('Activities grouped successfully.');
    } catch (error) {
        console.error('Error grouping activities:', error.message);
    }
}

async function editImsmanifest() {
    try {
        // Read the content of convert.json
        const convertFilePath = './uploads/convert.json';
        const convertContent = await filesystem.readFile(convertFilePath, 'utf-8');

        // Parse the JSON content
        const convertData = JSON.parse(convertContent);

        // Extract Topics array from convert.json
        const topicsArray = convertData.Topics || [];

        // Read the content of imsmanifest.xml
        const imsmanifestFilePath = './uploads/imsmanifest.xml';
        let imsmanifestContent = await filesystem.readFile(imsmanifestFilePath, 'utf-8');

        // Find the insertion point based on a pattern
        const insertPattern = '<item identifier="LearningModules">';
        const insertIndex = imsmanifestContent.indexOf(insertPattern) + insertPattern.length;

        // Generate XML content for each topic in Topics array
        const topicsXML = topicsArray
            .map(({ moduleID, topicName, resources }) => {
                const resourcesXML = resources
                    ? resources
                        .map(({ resourceID, fileID, activityName, resourceLocation }) => {
                            if (resourceLocation !== null) {
                                const TOAST = resourceLocation.split("file_uploads//")[1];
                                imsmanifestContent = imsmanifestContent.replace(
                                    '</resource>',
                                    `</resource>
<resource type="webcontent" identifier="${fileID}" href="web_resources/${TOAST}">
<file href="web_resources/${TOAST}"/>
</resource>`
                                );
                            }

                            return `<item identifier="${resourceID}" identifierref="${fileID}">
<title>${activityName}</title>
</item>`;
                        })
                        .filter(Boolean) // Filter out empty strings
                        .join('\n')
                    : '';

                return `<item identifier="${moduleID}">
<title>${topicName}</title>
${resourcesXML}
</item>`;
            })
            .join('\n');

        // Insert the generated XML content into imsmanifest.xml
        const updatedImsmanifestContent =
            imsmanifestContent.slice(0, insertIndex) + topicsXML + imsmanifestContent.slice(insertIndex);

        // Write the updated content back to imsmanifest.xml
        await filesystem.writeFile(imsmanifestFilePath, updatedImsmanifestContent);

        console.log('imsmanifest.xml updated successfully.');
    } catch (error) {
        console.error('Error editing imsmanifest.xml:', error.message);
    }
}

async function editModuleMeta() {
    try {
        // Read the content of convert.json
        const convertFilePath = './uploads/convert.json';
        const convertContent = await filesystem.readFile(convertFilePath, 'utf-8');

        // Parse the JSON content
        const convertData = JSON.parse(convertContent);

        // Extract Topics array from convert.json
        const topicsArray = convertData.Topics || [];

        // Read the content of module_meta.xml
        const moduleMetaFilePath = './uploads/module_meta.xml';
        let moduleMetaContent = await filesystem.readFile(moduleMetaFilePath, 'utf-8');

        // Find the insertion point based on a pattern
        const insertPattern = 'https://canvas.instructure.com/xsd/cccv1p0.xsd">';
        const insertIndex = moduleMetaContent.indexOf(insertPattern) + insertPattern.length;

        // Generate XML content for each topic in Topics array
        const topicsXML = topicsArray.map(({ moduleID, topicName, resources }, index) => {
            const THESI = index + 1;
            const itemsXML = resources
                ? resources.map(({ resourceID, fileID, activityName }, index2) => {
                    const THESI2 = index2 + 1;

                    return `<item identifier="${resourceID}">
  <content_type>Attachment</content_type>
  <workflow_state>active</workflow_state>
  <title>${activityName}</title>
  <identifierref>${fileID}</identifierref>
  <position>${THESI2}</position>
  <new_tab>false</new_tab>
  <indent>0</indent>
  <link_settings_json>null</link_settings_json>
  </item>`;
                }).join('\n')
                : '';

            return `<module identifier="${moduleID}">
  <title>${topicName}</title>
  <workflow_state>unpublished</workflow_state>
  <position>${THESI}</position>
  <require_sequential_progress>false</require_sequential_progress>
  <locked>false</locked>
  <items>
  ${itemsXML}
  </items>
  </module>`;
        }).join('\n');

        // Insert the generated XML content into module_meta.xml
        const updatedModuleMetaContent =
            moduleMetaContent.slice(0, insertIndex) + topicsXML + moduleMetaContent.slice(insertIndex);

        // Write the updated content back to module_meta.xml
        await filesystem.writeFile(moduleMetaFilePath, updatedModuleMetaContent);

        console.log('module_meta.xml updated successfully.');
    } catch (error) {
        console.error('Error editing module_meta.xml:', error.message);
    }
}

async function createCourseSettingsFolder() {
    try {
        const uploadsFolderPath = './uploads';
        const courseSettingsFolderPath = path.join(uploadsFolderPath, 'course_settings');

        // Create course_settings folder
        await filesystem.mkdir(courseSettingsFolderPath);

        console.log('course_settings folder created successfully.');
    } catch (error) {
        console.error('Error creating course_settings folder:', error.message);
    }
}

async function moveFilesToCourseSettings() {
    try {
        const uploadsFolderPath = './uploads';
        const courseSettingsFolderPath = path.join(uploadsFolderPath, 'course_settings');

        // List of files to move
        const filesToMove = ['course_settings.xml', 'module_meta.xml', 'assignment_groups.xml', 'files_meta.xml', 'context.xml', 'media_tracks.xml'];

        // Move each file to course_settings folder
        for (const file of filesToMove) {
            const sourcePath = path.join(uploadsFolderPath, file);
            const destinationPath = path.join(courseSettingsFolderPath, file);

            // Check if the destination already exists, and if so, add a unique suffix
            let suffix = 1;
            while (await fileExists(destinationPath)) {
                const [name, ext] = file.split('.');
                destinationPath = path.join(courseSettingsFolderPath, `${name}_${suffix}.${ext}`);
                suffix++;
            }

            await filesystem.rename(sourcePath, destinationPath);
        }

        console.log('Files moved to course_settings folder successfully.');
    } catch (error) {
        console.error('Error moving files to course_settings folder:', error.message);
    }
}

// Helper function to check if a file exists
async function fileExists(filePath) {
    try {
        await filesystem.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
}

async function createOutputFolder() {
    try {
        // Define the path for the output folder
        const outputPath = './uploads/output';

        // Create the output folder
        await filesystem.mkdir(outputPath);

        console.log('Output folder created successfully.');
    } catch (error) {
        console.error('Error creating output folder:', error.message);
    }
}

async function moveFoldersToOutput() {
    try {
        // Define paths for source and destination
        const sourcePaths = [
            './uploads/course_settings',
            './uploads/web_resources',
            './uploads/imsmanifest.xml',
        ];
        const outputFolderPath = './uploads/output';

        // Move files and folders to the output folder
        for (const sourcePath of sourcePaths) {
            const fileName = sourcePath.split('/').pop(); // Extract file/folder name

            // Define the destination path
            const destinationPath = path.join(outputFolderPath, fileName);

            // Move the file or folder
            await filesystem.rename(sourcePath, destinationPath);
        }

        console.log('Folders and files moved to the output folder successfully.');
    } catch (error) {
        console.error('Error moving folders to output folder:', error.message);
    }
}

const renameFile = util.promisify(fs.rename);

async function zipToImscc() {
    // Path to the folder you want to zip
    const folderToZip = 'uploads/output';

    // Check if the folder exists
    if (!fs.existsSync(folderToZip)) {
        throw new Error(`The folder ${folderToZip} does not exist.`);
    }

    // Create a zip file
    const zipFilename = 'uploads/output.zip';
    const output = fs.createWriteStream(zipFilename);
    const archive = archiver('zip', {
        zlib: { level: 9 } // compression level
    });

    archive.pipe(output);
    archive.directory(folderToZip, false);
    await archive.finalize();

    // Rename the zip file to .imscc
    const imsccFilename = 'uploads/output.imscc';
    await renameFile(zipFilename, imsccFilename);

    // Return the new .imscc filename
    return imsccFilename;
}

async function moveImsccFiles() {
    const uploadsFolder = 'uploads';
    const convertedFolder = 'converted';
    const fileExtension = '.imscc';

    try {
        // Read the contents of the uploads folder
        const files = await filesystem.readdir(uploadsFolder);

        // Filter files with the specified extension
        const imsccFiles = files.filter(file => path.extname(file) === fileExtension);

        // Move each imscc file to the converted folder
        await Promise.all(imsccFiles.map(async file => {
            const sourcePath = path.join(uploadsFolder, file);
            const destinationPath = path.join(convertedFolder, file);

            // Move the file
            await filesystem.rename(sourcePath, destinationPath);
            console.log(`Moved ${file} to ${convertedFolder}`);
        }));

        console.log('All .imscc files moved successfully.');
    } catch (error) {
        console.error('Error moving .imscc files:', error.message);
    }
}


async function extractCdmFile() {
    try {
        // Define the uploads directory
        const uploadsDir = path.join(__dirname, 'uploads');

        // Find the .cdm file in the uploads directory
        const files = fs.readdirSync(uploadsDir);
        const cdmFile = files.find(file => path.extname(file) === '.cdm');

        if (!cdmFile) {
            throw new Error('No .cdm file found in the uploads directory');
        }

        // Define the full path to the .cdm file
        const cdmFilePath = path.join(uploadsDir, cdmFile);

        // Create a new AdmZip instance with the .cdm file
        const zip = new AdmZip(cdmFilePath);

        // Extract all files to the uploads directory
        zip.extractAllTo(uploadsDir, true);

        console.log(`Extracted ${cdmFile} to ${uploadsDir}`);
    } catch (error) {
        console.error('Error extracting .cdm file:', error);
    }
}



async function createIMSCCFile() {
    try {

        createWebResourcesFolder();

        await extractCdmFile();

        await moveFilesToWebResources();

        await createXMLFiles();

        await createConvertJson();

        await writeTopicsOnConvert();

        await writeActivitiesOnConvert();

        await groupActivities();

        await editImsmanifest();

        await editModuleMeta();

        await createCourseSettingsFolder();

        await moveFilesToCourseSettings();

        await createOutputFolder();

        await moveFoldersToOutput();

        await zipToImscc();

        await moveImsccFiles();

        await deleteEverythingInUploadsFolder();

        // All tasks are completed
        console.log("All tasks are done!");
    } catch (error) {
        console.error("Error in createIMSCCFile:", error);
    }
}


// ############################# END OF CADMOS -> CANVAS #######################

// ############################# CANVAS -> CADMOS ##############################

// Function to extract .imscc file
async function extractIMSCC(filePath, extractTo) {
    return new Promise((resolve, reject) => {
        try {
            // Check if the file exists
            if (!fs.existsSync(filePath)) {
                reject(new Error(`File not found: ${filePath}`));
                return;
            }

            // Create an instance of AdmZip with the file path
            const zip = new AdmZip(filePath);

            // Extract all contents to the specified directory (synchronously)
            zip.extractAllTo(extractTo, true);
            resolve(`Files extracted to ${extractTo}`);
        } catch (err) {
            reject(err);
        }
    });
}

// Function to move specific files and folders from "extracted" to "uploads"
async function moveExtractedItems(extractFrom, moveTo) {
    return new Promise((resolve, reject) => {
        try {
            const itemsToMove = ['imsmanifest.xml', 'course_settings', 'web_resources', 'wiki_content'];

            itemsToMove.forEach(item => {
                const srcPath = path.join(extractFrom, item);
                const destPath = path.join(moveTo, item);

                if (fs.existsSync(srcPath)) {
                    fs.renameSync(srcPath, destPath);
                }
            });

            // Explicitly move module_meta.xml if it exists inside course_settings
            const moduleMetaPath = path.join(moveTo, 'course_settings', 'module_meta.xml');
            if (fs.existsSync(moduleMetaPath)) {
                const destPath = path.join(moveTo, 'module_meta.xml');
                fs.renameSync(moduleMetaPath, destPath);
                console.log('module_meta.xml moved to uploads directory.');
            } else {
                console.log('module_meta.xml not found.');
            }

            // Remove course_settings folder if it exists
            const courseSettingsPath = path.join(moveTo, 'course_settings');
            if (fs.existsSync(courseSettingsPath) && fs.lstatSync(courseSettingsPath).isDirectory()) {
                fs.rmSync(courseSettingsPath, { recursive: true, force: true });
                console.log('course_settings folder deleted.');
            }

            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

// Function to clean up the extracted directory
async function cleanExtractedDirectory(extractTo) {
    return new Promise((resolve, reject) => {
        fs.rm(extractTo, { recursive: true, force: true }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Function to recursively move files from a directory
function moveFilesRecursively(srcDir, destDir) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath);
            }
            moveFilesRecursively(srcPath, destPath);
        } else {
            fs.renameSync(srcPath, destPath);
        }
    }
}

// Function to move contents of subfolders to uploads folder and handle name conflicts
async function flattenWebResources(webResourcesDir, uploadsDir) {
    return new Promise((resolve, reject) => {
        try {
            const subfoldersToFlatten = ['course_image', 'Uploaded Media'];

            subfoldersToFlatten.forEach(subfolder => {
                const subfolderPath = path.join(webResourcesDir, subfolder);

                if (fs.existsSync(subfolderPath) && fs.lstatSync(subfolderPath).isDirectory()) {
                    // Move each file to the uploads directory recursively
                    moveFilesRecursively(subfolderPath, uploadsDir);

                    // Remove the now-empty subfolder
                    fs.rmdirSync(subfolderPath);
                }
            });

            // Remove the web_resources folder itself
            if (fs.existsSync(webResourcesDir)) {
                moveFilesRecursively(webResourcesDir, uploadsDir);
                fs.rmdirSync(webResourcesDir);
            }

            resolve('Web resources flattened and cleaned up successfully.');
        } catch (err) {
            reject(err);
        }
    });
}

// Function to move contents of wiki_content folder to uploads folder and handle name conflicts
async function flattenWikiContent(wikiContentDir, uploadsDir) {
    return new Promise((resolve, reject) => {
        try {
            if (fs.existsSync(wikiContentDir) && fs.lstatSync(wikiContentDir).isDirectory()) {
                // Move each file to the uploads directory recursively
                moveFilesRecursively(wikiContentDir, uploadsDir);

                // Remove the now-empty wiki_content folder
                fs.rmdirSync(wikiContentDir);
                console.log('wiki_content folder deleted.');
            }

            resolve('Wiki content flattened and cleaned up successfully.');
        } catch (err) {
            reject(err);
        }
    });
}

// Function to read imsmanifest.xml and get resource href
async function getResourceLocation(uploadsDir, identifierref) {
    return new Promise((resolve, reject) => {
        const manifestPath = path.join(uploadsDir, 'imsmanifest.xml');
        const manifestData = fs.readFileSync(manifestPath, 'utf-8');

        const parser = new xml2js.Parser({ explicitArray: false });

        parser.parseString(manifestData, (err, result) => {
            if (err) {
                reject(err);
                return;
            }

            const resources = result.manifest.resources.resource;
            const resource = resources.find(r => r.$.type === 'webcontent' && r.$.identifier === identifierref);

            if (resource && resource.file) {
                const href = resource.file.$.href.replace('web_resources/', '');
                resolve(href);
            } else {
                resolve(null);
            }
        });
    });
}

// Function to read imsmanifest.xml and get the value of <lomimscc:string>
async function getStrategyName(uploadsDir) {
    return new Promise((resolve, reject) => {
        const manifestPath = path.join(uploadsDir, 'imsmanifest.xml');
        const manifestData = fs.readFileSync(manifestPath, 'utf-8');

        const parser = new xml2js.Parser({ explicitArray: false });

        parser.parseString(manifestData, (err, result) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                const strategyName = result.manifest.metadata['lomimscc:lom']['lomimscc:general']['lomimscc:title']['lomimscc:string'];
                resolve(strategyName);
            } catch (e) {
                resolve(null);
            }
        });
    });
}

// Function to convert module_meta.xml to source.json
async function convertModuleMetaToJSON(uploadsDir) {
    return new Promise(async (resolve, reject) => {
        // Define the file paths
        const xmlFilePath = path.join(uploadsDir, 'module_meta.xml');
        const jsonFilePath = path.join(uploadsDir, 'source.json');

        // Read the XML file
        const xmlData = fs.readFileSync(xmlFilePath, 'utf-8');

        // Get strategy name from imsmanifest.xml
        const strategyName = await getStrategyName(uploadsDir);

        // Parse the XML data using xml2js
        const parser = new xml2js.Parser({
            explicitArray: false, // Prevent converting to arrays for single elements
        });

        let leftCounter = 100; // Counter for generating left values
        let facilitatorIdCounter = 1; // Counter for generating Facilitator IDs
        let topValue = 300; // Initial top value for Facilitator

        // Initialize the jsonData object
        const jsonData = {
            data: {
                Conceptual: {
                    ConceptualBase: [], // Add the item structures
                },
                LessonInfo: {
                    StrategyName: strategyName || 'blank', // Set the StrategyName field
                    DurationNumber: 0,
                    DurationType: 'Minutes',
                    EducationLevel: null,
                    SubjectArea: null,
                    Description: null,
                    Goals: [
                        'The student writes down...',
                    ],
                    GoalsRemembering: [
                        'The student writes down...',
                    ],
                    GoalsUnderstanding: [],
                    GoalsApplying: [],
                    GoalsAnalyzing: [],
                    GoalsEvaluating: [],
                    GoalsCreating: [],
                    Actors: ['Student', 'Teacher'],
                    Learners: ['Student'],
                    StaffRoles: ['Teacher'],
                    Prerequisites: [],
                },
                LessonInfoExtras: {
                    Simple_activity_types: [
                        'Creating',
                        'Evaluating',
                        'Analyzing',
                        'Applying',
                        'Understanding',
                        'Remembering',
                    ],
                    Resource_types: [
                        'Hypertext',
                        'Audio',
                        'Video',
                        'Image',
                        'Document',
                        'Assessment',
                        'Forum',
                        'Quiz',
                        'Wiki',
                        'Poll',
                        'Chat',
                        'Page (Moodle)',
                        'Book (Moodle)',
                        'Glossary (Moodle)',
                        'Database (Moodle)',
                        'Lesson (Moodle)',
                        'Survey (Moodle)',
                        'Feedback (Moodle)',
                        'H5P (Moodle)',
                        'Other',
                    ],
                    Resource_copyright: ['free', 'proprietary'],
                },
                Flow: {
                    FlowSub: [], // flowTopic
                    FlowBase: [
                        {
                            ActorName: 'Student',
                            ActorX: 1,
                            Activities: [], // flowActivities
                        },
                        {
                            ActorName: 'Facilitator',
                            ActorX: 3,
                            Activities: [], // flowActivities
                        },
                    ],
                },
            },
        };

        parser.parseString(xmlData, async (err, result) => {
            if (err) {
                reject('Error parsing XML:', err);
                return;
            }

            let idCounter = 0;
            let itemId = `widgetItem${idCounter++}`;
            let leftValue = leftCounter;
            let topValueFlow = 200; // Initial top value for FlowSub
            let moduleCounter = 1; // Counter for modules

            // Extract and assign item titles and item structures to variables
            if (result.modules && result.modules.module) {
                const modules = Array.isArray(result.modules.module) ? result.modules.module : [result.modules.module];
                for (const module of modules) {
                    if (module.items && module.items.item) {
                        const items = Array.isArray(module.items.item) ? module.items.item : [module.items.item];

                        // Create a new structure inside FlowSub for each module
                        jsonData.data.Flow.FlowSub.push({
                            top: topValueFlow + 0.673543534,
                            left: 0,
                            type: 'flowPhase',
                            text: module.title, // Use the title of the module
                            id: `flowPhase${moduleCounter}`, // Create an ID based on the module count
                        });

                        moduleCounter++; // Increment module count

                        // Inside the loop that processes items
                        for (const item of items) {
                            itemId = `widgetItem${idCounter++}`;
                            leftValue = leftCounter;
                            leftCounter += 100;
                            topValueFlow += 300; // Increase topValue based on the number of items in the module

                            // Create the item structure with the same left value for both left properties
                            const itemStructure = {
                                id: itemId,
                                type: 'activity-simple',
                                top: 250,
                                left: leftValue,
                                linkToBase: true,
                                children: [
                                    {
                                        id: `widgetItem${idCounter++}`,
                                        type: 'activity-resource',
                                        top: 550,
                                        left: leftValue, // Set the left value for the resource
                                        linkToBase: false,
                                        children: [],
                                        ModalData: {
                                            Title: 'Add hyperlink',
                                            Author: null,
                                            Description: null,
                                            Type: 'Hypertext',
                                            Copyright: null,
                                            ResourceLocation: null,
                                        },
                                    },
                                ],
                                ModalData: {
                                    Title: item.title, // Use the item title
                                    Description: 'Please add a description',
                                    LearningGoal: [],
                                    Type: 'Remembering',
                                    Actor: 'Student',
                                    Facilitator: 'Teacher',
                                    TimeLimit: 0,
                                },
                            };

                            // If <identifierref> exists, find the corresponding resource and update ResourceLocation
                            if (item.identifierref) {
                                const resourceLocation = await getResourceLocation(uploadsDir, item.identifierref);
                                if (resourceLocation) {
                                    itemStructure.children[0].ModalData.ResourceLocation = resourceLocation;
                                    itemStructure.children[0].ModalData.IsStoredFile = true;
                                }
                            }

                            // Add the item structure to the ConceptualBase
                            jsonData.data.Conceptual.ConceptualBase.push(itemStructure);

                            // Create a structure inside the Activities array for "Facilitator"
                            jsonData.data.Flow.FlowBase
                                .find(actor => actor.ActorName === 'Facilitator')
                                .Activities.push({
                                    id: `Facilitator${facilitatorIdCounter}`,
                                    top: topValue,
                                });

                            // Create a structure inside the Activities array for "Student"
                            jsonData.data.Flow.FlowBase
                                .find(actor => actor.ActorName === 'Student')
                                .Activities.push({
                                    id: itemId, // activityID is the same as the item ID
                                    title: item.title, // itemName is the same as the item title
                                    top: topValue, // top value follows the same pattern
                                });

                            // Increment counters and values for the next item
                            facilitatorIdCounter += 1;
                            topValue += 300;
                        }
                    }
                }
            }

            // Write the JSON to a file
            fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');
            resolve('JSON data has been written to source.json');
        });
    });
}

// Function to zip everything inside the uploads directory
async function zipUploadsDirectory(uploadsDir) {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip();
            const outputFilePath = path.join(uploadsDir, 'uploads.zip');

            zip.addLocalFolder(uploadsDir);
            zip.writeZip(outputFilePath);

            resolve(outputFilePath);
        } catch (err) {
            reject(err);
        }
    });
}

// Function to rename the zip file to .cdm
async function renameZipFileToCDM(zipFilePath) {
    return new Promise((resolve, reject) => {
        const newFilePath = zipFilePath.replace('.zip', '.cdm');
        fs.rename(zipFilePath, newFilePath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(newFilePath);
            }
        });
    });
}

// Function to delete everything in the uploads directory except the zip file
async function cleanUploadsDirectory(uploadsDir, zipFileName) {
    return new Promise((resolve, reject) => {
        try {
            const files = fs.readdirSync(uploadsDir);

            files.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                if (file !== zipFileName) {
                    if (fs.lstatSync(filePath).isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                }
            });

            resolve('Uploads directory cleaned except for the zip file.');
        } catch (err) {
            reject(err);
        }
    });
}

// Function to move the .cdm file to the converted directory
async function moveCDMToConverted(cdmFilePath, convertedDir) {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(cdmFilePath);
        const destPath = path.join(convertedDir, fileName);

        fs.rename(cdmFilePath, destPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(`Moved .cdm file to ${destPath}`);
            }
        });
    });
}

// Function to handle the conversion process
async function convertIMSCC() {
    // Define paths
    const uploadsDir = path.join(__dirname, 'uploads');
    const extractToDir = path.join(uploadsDir, 'extracted');
    const convertedDir = path.join(__dirname, 'converted');

    try {
        // Find the first .imscc file in the uploads directory
        const files = fs.readdirSync(uploadsDir);
        const imsccFile = files.find(file => file.endsWith('.imscc'));

        if (!imsccFile) {
            throw new Error('No .imscc file found in the uploads directory');
        }

        const imsccFilePath = path.join(uploadsDir, imsccFile);

        // Create extracted folder if it does not exist
        if (!fs.existsSync(extractToDir)) {
            fs.mkdirSync(extractToDir);
        }

        // Extract the IMSCC file
        await extractIMSCC(imsccFilePath, extractToDir);

        // Move the required items from "extracted" to "uploads"
        await moveExtractedItems(extractToDir, uploadsDir);

        // Clean up the extracted directory
        await cleanExtractedDirectory(extractToDir);

        // Process the web_resources directory
        const webResourcesDir = path.join(uploadsDir, 'web_resources');
        const flattenMessage = await flattenWebResources(webResourcesDir, uploadsDir);
        console.log(flattenMessage);

        // Process the wiki_content directory
        const wikiContentDir = path.join(uploadsDir, 'wiki_content');
        const wikiMessage = await flattenWikiContent(wikiContentDir, uploadsDir);
        console.log(wikiMessage);

        // Convert module_meta.xml to source.json
        const convertMessage = await convertModuleMetaToJSON(uploadsDir);
        console.log(convertMessage);

        // Delete the .imscc file
        fs.unlinkSync(imsccFilePath);
        console.log(`.imscc file ${imsccFilePath} deleted.`);

        // Zip the uploads directory
        const zipFilePath = await zipUploadsDirectory(uploadsDir);
        console.log(`Uploads directory zipped to ${zipFilePath}`);

        // Rename the zip file to .cdm
        const cdmFilePath = await renameZipFileToCDM(zipFilePath);
        console.log(`Renamed zip file to ${cdmFilePath}`);

        // Clean the uploads directory except the .cdm file
        const cleanMessage = await cleanUploadsDirectory(uploadsDir, path.basename(cdmFilePath));
        console.log(cleanMessage);

        // Move the .cdm file to the converted directory
        const moveMessage = await moveCDMToConverted(cdmFilePath, convertedDir);
        console.log(moveMessage);

        console.log('Conversion process completed successfully.');
    } catch (err) {
        console.error('Error during conversion:', err);
    }
}

async function deleteEverythingInUploadsFolder() {
    const uploadsFolder = path.join(__dirname, 'uploads');

    try {
        // Read the contents of the uploads folder
        const files = await filesystem.readdir(uploadsFolder);

        // Delete each file or directory
        await Promise.all(files.map(async file => {
            const filePath = path.join(uploadsFolder, file);
            
            // Check if it's a file or directory
            const stat = await filesystem.stat(filePath);

            if (stat.isDirectory()) {
                await filesystem.rm(filePath, { recursive: true });
                console.log(`Deleted directory: ${filePath}`);
            } else {
                await filesystem.unlink(filePath);
                console.log(`Deleted file: ${filePath}`);
            }
        }));

        console.log('Deletion completed.');

    } catch (error) {
        console.error('Error deleting files:', error);
    }
}

// ############################# END OF CANVAS -> CADMOS #######################

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const url = require('url');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = http.createServer(async (request, response) => {

    const {
        query: {
            resource,
        }
    } = url.parse(request.url, {parseQueryString: true});

    if (request.url === '/dom-to-image.js') {
        return serveFile(path.join(__dirname, '../src/dom-to-image.js'));
    }

    try {

        const resources = await getResources();
        const testInput = resource && await loadFile(path.join(__dirname, './resources/', resource, 'dom-node.html')) || '';
        const testExpected = resource && await loadFile(path.join(__dirname, './resources/', resource, 'control-image')) || '';
        const style = resource && await loadFile(path.join(__dirname, './resources/', resource, 'style.css')) || '';

        serveHtml({
            resources,
            name: resource,
            input: testInput,
            expected: testExpected,
            style,
        });

    } catch (err) {
        serveError(err);
    }

    function serveError(err) {

        console.error(err);

        response.writeHead(200, {"Content-Type": "text/html"});
        response.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Error: ${err.message} | Test Server</title>
</head>
<body>

    <h1>${err.message}</h1>
    
    <pre>
        ${JSON.stringify(err.stacktrace, null, 4)}
    </pre>

</body>
</html>`);
        response.end();

    }

    function serveHtml({resources, name, input, expected, style}) {

        response.writeHead(200, {"Content-Type": "text/html"});
        response.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${name} | Test Server</title>
    <script src="/dom-to-image.js"></script>
    <style>
        * {
            box-sizing: border-box;
        }        
    </style>
    <style>
        ${style}
    </style>    
</head>
<body>

    <form method="get" action="">
        <label>
            Resources
            <select name="resource">
                ${resources.map(r => `<option ${r.fileName === resource ? 'selected="selected"' : ''}>${r.fileName}</option>`)}
            </select>
        </label>
        <button type="submit">Test</button>
    </form>

    <h1>Test ${name}</h1>

    <div>
        <h1>DOM node</h1>
        <div id="dom-node">${input}</div>
    </div>
    
    <div>
        <h1>rendered image</h1>
        <div class="actuals">
            <div>
                <h2>PNG</h2>
                <div id="actual-toPng"></div>
            </div>
            <div>
                <h2>JPG</h2>
                <div id="actual-toJpeg"></div>
            </div>
            <div>
                <h2>SVG</h2>
                <div id="actual-toSvg"></div>
            </div>
        </div>
    </div>
    
    <div>
        <h1>control image</h1>
        <img id="control-image" src="${expected}">
    </div>
    
    <script>
    
        const methods = ['toPng', 'toJpeg', 'toSvg'];
    
        methods.forEach(method => {
            
            domtoimage[method](document.getElementById('dom-node'))
                .then(dataUrl => {
                    const img = new Image();
                    img.src = dataUrl;
                    document.getElementById('actual-' + method).appendChild(img); 
                });
            
        });
    
    </script>

</body>
</html>`);
        response.end();

    }

    function serveFile(filePath, contentType = 'application/javascript') {

        loadFile(filePath)
            .then(
                contents => {
                    response.writeHead(200, {'Content-Type': contentType});
                    response.write(contents);
                    response.end();
                },
                err => {
                    response.writeHead(500);
                    response.write(JSON.stringify(err, null, 4));
                    response.end();
                }
            );

    }

});

const port = 3000;
console.log(`Starting test server on ${port}`);
app.listen(port);

const RESOURCES_PATH = path.join(__dirname, './resources');


function loadFile(filePath) {

    return new Promise((resolve, reject) => {

        fs.readFile(filePath, 'utf8', (err, contents) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    return resolve('<none>');
                }
                return reject(err);
            }
            resolve(contents);
        });

    });

}

function getResources() {

    return new Promise((resolve, reject) => {

        fs.readdir(RESOURCES_PATH, (err, files) => {

            if (err) {
                return reject(err);
            }

            const directories = Promise
                .all(files.map(fileName => {
                        // expand paths
                        const filePath = path.join(RESOURCES_PATH, fileName);
                        // check file stats
                        return isDirectory(filePath)
                            .then(isDirectory => ({
                                fileName,
                                filePath,
                                isDirectory,
                            }));
                    })
                )
                .then(files => {
                    return files
                    // keep only directories
                        .filter(f => f.isDirectory);
                });

            resolve(directories);

        });

    });

}

function isDirectory(filePath) {

    return new Promise((resolve, reject) => {

        fs.stat(filePath, (err, stats) => {

            if (err) {
                return reject(err);
            }

            resolve(stats.isDirectory());

        });

    });

}

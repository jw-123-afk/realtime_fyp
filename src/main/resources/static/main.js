console.log("Main.js V17 Loaded (Link Fix + ID Fix)");

var stompClient = null;
var myClientId = Math.random().toString(36).substring(7);
var quill = null;
var draggedImage = null;

try {
    var ImageResize = window.ImageResize;
    if (ImageResize && typeof ImageResize !== 'function' && ImageResize.default) {
        ImageResize = ImageResize.default;
    }
    if (ImageResize) Quill.register('modules/imageResize', ImageResize);

    // 2. INITIALIZE QUILL
    quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: '#toolbar-container',
                handlers: {
                    'image': imageHandler,
                    'attach-file': fileHandler,
                    'link': linkHandler // <--- NEW: Custom Link Handler
                }
            },
            imageResize: {
                displaySize: true,
                modules: [ 'Resize', 'DisplaySize' ]
            }
        }
    });

    // --- DRAG AND DROP LOGIC ---
    quill.root.addEventListener('dragstart', function(e) {
        if (e.target && e.target.tagName === 'IMG') {
            var blot = Quill.find(e.target);
            var index = quill.getIndex(blot);
            draggedImage = {
                src: e.target.src,
                index: index,
                width: e.target.width,
                height: e.target.height,
                style: e.target.style.cssText
            };
            e.dataTransfer.setData('text/plain', 'image-move');
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    quill.root.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    quill.root.addEventListener('drop', function(e) {
        if (!draggedImage) return;
        e.preventDefault();

        var range;
        if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(e.clientX, e.clientY);
        else if (document.caretPositionFromPoint) {
            var pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
        }

        if (range) {
            var blot = Quill.find(range.startContainer);
            if (!blot) blot = Quill.find(quill.root);
            var newIndex = blot ? quill.getIndex(blot) + range.startOffset : quill.getLength();

            var totalLength = quill.getLength();
            if (newIndex >= totalLength - 1) {
                var dropY = e.clientY - quill.root.getBoundingClientRect().top;
                if (dropY > quill.root.scrollHeight) {
                    var lines = Math.floor((dropY - quill.root.scrollHeight) / 20) + 1;
                    quill.insertText(totalLength - 1, "\n".repeat(lines), 'user');
                    newIndex = quill.getLength();
                }
            }

            quill.insertEmbed(newIndex, 'image', draggedImage.src, 'user');
            if(draggedImage.width) quill.formatText(newIndex, 1, 'width', draggedImage.width + 'px', 'user');
            if(draggedImage.height) quill.formatText(newIndex, 1, 'height', draggedImage.height + 'px', 'user');

            var delIndex = draggedImage.index;
            if (newIndex <= delIndex) delIndex++;
            quill.deleteText(delIndex, 1, 'user');

            draggedImage = null;
            setTimeout(function() { var Delta = Quill.import('delta'); quill.updateContents(new Delta()); }, 50);
        }
    });

} catch (e) {
    console.error("CRITICAL ERROR:", e);
}

// --- HANDLERS ---

// 1. LINK HANDLER (The Fix)
function linkHandler() {
    var range = quill.getSelection();
    if (range) {
        var value = prompt('Enter link URL:'); // Popup box
        if (value) {
            quill.format('link', value);
        }
    } else {
        alert("Please click somewhere in the text first.");
    }
}

function imageHandler() {
    var input = document.getElementById('image-upload');
    if(input) input.click();
    input.onchange = function() {
        if(input.files[0]) uploadFileToServer(input.files[0], 'image');
    };
}

function fileHandler() {
    var input = document.getElementById('file-upload');
    if(input) input.click();
    input.onchange = function() {
        if(input.files[0]) uploadFileToServer(input.files[0], 'file');
    };
}

function uploadFileToServer(file, type) {
    if (!quill) return;
    var formData = new FormData();
    formData.append('file', file);

    fetch('/upload', { method: 'POST', body: formData })
    .then(response => response.text().then(text => ({ status: response.status, ok: response.ok, body: text })))
    .then(result => {
        if (!result.ok) throw new Error("Error " + result.status);
        var data = JSON.parse(result.body);
        if (data.url) {
            var range = quill.getSelection(true);
            var index = (range) ? range.index : quill.getLength();
            var safeUrl = encodeURI(data.url);
            if (type === 'image') {
                quill.insertEmbed(index, 'image', safeUrl, 'user');
            } else {
                quill.insertText(index, "📄 " + data.name, 'link', safeUrl, 'user');
            }
            quill.setSelection(index + 1);
        }
    })
    .catch(error => { console.error('Upload Error:', error); alert("Upload failed."); });
}

// --- WEBSOCKET LOGIC ---
function connect() {
    var socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;
    stompClient.connect({}, function (frame) {

        // --- ID DISPLAY FIX ---
        // This makes sure the ID is put into the header
        var statusDiv = document.getElementById("status");
        statusDiv.innerHTML = 'Online: <span style="color:#1967d2; font-weight:bold;">' + myClientId + '</span>';

        stompClient.subscribe('/topic/document', function (msg) {
            var m = JSON.parse(msg.body);
            if(m.sender !== myClientId && quill) quill.updateContents(JSON.parse(m.content).delta);
        });
        stompClient.subscribe('/topic/history', function (msg) {
            var c = JSON.parse(msg.body).content;
            if(c) {
                var s = JSON.parse(c);
                quill.setContents(s.fullDoc ? s.fullDoc : s);
            }
        });
        stompClient.subscribe('/topic/users', function (msg) {
            document.getElementById("user-count").innerHTML = '<i class="fa-solid fa-users"></i> ' + JSON.parse(msg.body).content;
        });
        stompClient.send("/app/join", {}, JSON.stringify({ 'sender': myClientId }));
    });
}
if (quill) {
    quill.on('text-change', function(delta, oldDelta, source) {
        if (source === 'user' && stompClient && stompClient.connected) {
            stompClient.send("/app/edit", {}, JSON.stringify({
                'content': JSON.stringify({ delta: delta, fullDoc: quill.getContents() }),
                'sender': myClientId
            }));
        }
    });
}
connect();

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFImage, PDFEmbeddedPage } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.mjs';

// --- DOM Elements ---
const addFilesBtn = document.getElementById('add-files-btn') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const clearListBtn = document.getElementById('clear-list-btn') as HTMLButtonElement;
const fileListElem = document.getElementById('file-list') as HTMLUListElement;
const moveUpBtn = document.getElementById('move-up-btn') as HTMLButtonElement;
const moveDownBtn = document.getElementById('move-down-btn') as HTMLButtonElement;

const editorSection = document.getElementById('editor-section') as HTMLElement;
const editorInfo = document.getElementById('editor-info') as HTMLElement;
const pageRangeInput = document.getElementById('page-range-input') as HTMLInputElement;
const applyRangeBtn = document.getElementById('apply-range-btn') as HTMLButtonElement;
const resetRangeBtn = document.getElementById('reset-range-btn') as HTMLButtonElement;

const layoutSelect = document.getElementById('layout-select') as HTMLSelectElement;
const invertCheck = document.getElementById('invert-check') as HTMLInputElement;
const monochromeCheck = document.getElementById('monochrome-check') as HTMLInputElement;
const processBtn = document.getElementById('process-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;


const statusLabel = document.getElementById('status-label') as HTMLElement;
const timeLabel = document.getElementById('time-label') as HTMLElement;
const progressBar = document.getElementById('progress-bar') as HTMLProgressElement;

// --- App State ---
let fileListData: { name: string, buffer: ArrayBuffer, pagesToRemove: string }[] = [];
let selectedFileIndex = -1;
let isProcessing = false;
let isCancelled = false;


// --- UI Update Functions ---
function updateUI() {
    // File list
    fileListElem.innerHTML = '';
    if (fileListData.length === 0) {
        fileListElem.innerHTML = '<li class="placeholder">Add files to see them here.</li>';
    } else {
        fileListData.forEach((file, index) => {
            const li = document.createElement('li');
            li.dataset.index = String(index); // FIX: dataset properties must be strings
            li.textContent = file.name;
            if (file.pagesToRemove) {
                const span = document.createElement('span');
                span.className = 'removed-pages';
                span.textContent = `[Removing: ${file.pagesToRemove}]`;
                li.appendChild(span);
            }
            if (index === selectedFileIndex) {
                li.classList.add('selected');
            }
            fileListElem.appendChild(li);
        });
    }

    // Editor section
    const hasSelection = selectedFileIndex !== -1;
    editorSection.setAttribute('aria-disabled', String(!hasSelection || isProcessing)); // FIX: setAttribute value must be a string
    if (hasSelection) {
        const selectedFile = fileListData[selectedFileIndex];
        editorInfo.textContent = `Editing: ${selectedFile.name}`;
        pageRangeInput.value = selectedFile.pagesToRemove || '';
    } else {
        editorInfo.textContent = 'Select a file to edit its pages.';
        pageRangeInput.value = '';
    }
    
    // Buttons
    processBtn.disabled = fileListData.length === 0 || isProcessing;
    clearListBtn.disabled = fileListData.length === 0 || isProcessing;
    moveUpBtn.disabled = !hasSelection || selectedFileIndex === 0 || isProcessing;
    moveDownBtn.disabled = !hasSelection || selectedFileIndex === fileListData.length - 1 || isProcessing;
}

function updateProgress(current: number, total: number, startTime: number, text?: string) {
    if (isProcessing) {
        const progress = total > 0 ? (current / total) * 100 : 0;
        progressBar.value = progress;
        statusLabel.textContent = text || `Processing page ${current} of ${total}...`;
        
        const elapsed = (Date.now() - startTime) / 1000;
        const elapsedStr = `Elapsed: ${new Date(elapsed * 1000).toISOString().slice(14, 19)}`;

        if (progress > 0 && progress < 100) {
            const eta = (elapsed / current) * (total - current);
            const etaStr = `ETA: ${new Date(eta * 1000).toISOString().slice(14, 19)}`;
            timeLabel.textContent = `${elapsedStr}, ${etaStr}`;
        } else {
             timeLabel.textContent = elapsedStr;
        }
    }
}

// --- Event Handlers ---
addFilesBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (event: Event) => {
    const target = event.target as HTMLInputElement; // FIX: Cast event target
    const files = target.files;
    if (!files) return;

    for (const file of files) {
        const existing = fileListData.find(f => f.name === file.name);
        if (!existing) {
            const buffer = await file.arrayBuffer();
            fileListData.push({ name: file.name, buffer, pagesToRemove: '' });
        }
    }
    if (fileListData.length > 0 && selectedFileIndex === -1) {
        selectedFileIndex = 0;
    }
    fileInput.value = ''; // Reset for next selection
    updateUI();
});

fileListElem.addEventListener('click', (event: MouseEvent) => {
    if (isProcessing) return;
    const target = (event.target as HTMLElement).closest('li'); // FIX: Cast event target
    if (target && target.dataset.index) {
        selectedFileIndex = parseInt(target.dataset.index, 10);
        updateUI();
    }
});

clearListBtn.addEventListener('click', () => {
    fileListData = [];
    selectedFileIndex = -1;
    updateUI();
    statusLabel.textContent = 'Select files to begin.';
    statusLabel.className = '';
    timeLabel.textContent = '';
    progressBar.value = 0;
});

moveUpBtn.addEventListener('click', () => {
    if (selectedFileIndex > 0) {
        [fileListData[selectedFileIndex], fileListData[selectedFileIndex - 1]] = 
        [fileListData[selectedFileIndex - 1], fileListData[selectedFileIndex]];
        selectedFileIndex--;
        updateUI();
    }
});

moveDownBtn.addEventListener('click', () => {
    if (selectedFileIndex < fileListData.length - 1) {
        [fileListData[selectedFileIndex], fileListData[selectedFileIndex + 1]] = 
        [fileListData[selectedFileIndex + 1], fileListData[selectedFileIndex]];
        selectedFileIndex++;
        updateUI();
    }
});

applyRangeBtn.addEventListener('click', () => {
    if (selectedFileIndex !== -1) {
        const rangeStr = pageRangeInput.value.trim();
        // Basic validation - allows numbers, commas, hyphens, and whitespace
        if (rangeStr && !/^[0-9,\s-]+$/.test(rangeStr)) {
            alert("Invalid characters in page range. Please use numbers, commas, and hyphens only.");
            return;
        }
        fileListData[selectedFileIndex].pagesToRemove = rangeStr;
        updateUI();
    }
});

resetRangeBtn.addEventListener('click', () => {
     if (selectedFileIndex !== -1) {
        fileListData[selectedFileIndex].pagesToRemove = '';
        updateUI();
    }
});

processBtn.addEventListener('click', () => processPDFs());

cancelBtn.addEventListener('click', () => {
    if (isProcessing) {
        isCancelled = true;
        statusLabel.textContent = 'Cancelling...';
        statusLabel.className = '';
    }
});

// --- Core Processing Logic ---
async function getPagesToProcess() {
    const pagesToProcess: { buffer: ArrayBuffer, pageNum: number }[] = [];
    for (const fileData of fileListData) {
        try {
            const pdfDoc = await pdfjs.getDocument(fileData.buffer.slice(0)).promise;
            const totalPages = pdfDoc.numPages;
            
            let pagesToKeep = new Set(Array.from({length: totalPages}, (_, i) => i + 1));

            if (fileData.pagesToRemove) {
                const pagesToRemove = new Set<number>();
                const parts = fileData.pagesToRemove.split(',');
                for (const part of parts) {
                    const trimmedPart = part.trim();
                    if (trimmedPart.includes('-')) {
                        const rangeParts = trimmedPart.split('-').map(s => s.trim());
                        const start = parseInt(rangeParts[0], 10);

                        // Handle "N-" syntax (e.g., "5-" means 5 to end)
                        if (rangeParts.length === 2 && rangeParts[1] === '' && !isNaN(start)) {
                            for (let i = start; i <= totalPages; i++) pagesToRemove.add(i);
                        } 
                        // Handle "N-M" syntax
                        else {
                            const end = parseInt(rangeParts[1], 10);
                            if (!isNaN(start) && !isNaN(end)) {
                                for (let i = start; i <= end; i++) pagesToRemove.add(i);
                            }
                        }
                    } else {
                        const num = parseInt(trimmedPart, 10);
                        if (!isNaN(num)) pagesToRemove.add(num);
                    }
                }
                pagesToKeep = new Set([...pagesToKeep].filter(x => !pagesToRemove.has(x)));
            }
            
            for (const pageNum of [...pagesToKeep].sort((a,b) => a-b)) {
                pagesToProcess.push({ buffer: fileData.buffer, pageNum });
            }
        } catch(e) {
            throw new Error(`Could not read ${fileData.name}: ${(e as Error).message}`);
        }
    }
    return pagesToProcess;
}

async function renderPageToCanvas(buffer: ArrayBuffer, pageNum: number): Promise<HTMLCanvasElement> {
    const pdfJSDoc = await pdfjs.getDocument(buffer.slice(0)).promise;
    const page = await pdfJSDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // ~200 DPI

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error("Could not get canvas context");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
}


async function processPDFs() {
    if (isProcessing) return;
    
    isProcessing = true;
    isCancelled = false;
    document.body.classList.add('processing');
    updateUI();

    const startTime = Date.now();
    statusLabel.className = '';
    timeLabel.textContent = '';
    progressBar.value = 0;

    try {
        updateProgress(0, 100, startTime, 'Parsing page ranges...');
        const pagesToProcess = await getPagesToProcess();
        const totalSourcePages = pagesToProcess.length;
        if (totalSourcePages === 0) throw new Error("No pages selected to process.");
        if (isCancelled) return;

        const doInvert = invertCheck.checked;
        const doMonochrome = monochromeCheck.checked;
        const isImageProcessingNeeded = doInvert || doMonochrome;
        
        const finalDoc = await PDFDocument.create();
        const layout = parseInt(layoutSelect.value, 10);

        if (layout === 1) {
            // Simple 1-up layout
            for (let i = 0; i < totalSourcePages; i++) {
                if (isCancelled) break;
                const { buffer, pageNum } = pagesToProcess[i];
                updateProgress(i + 1, totalSourcePages, startTime, `Processing page ${i + 1} of ${totalSourcePages}...`);

                if (isImageProcessingNeeded) {
                    const canvas = await renderPageToCanvas(buffer, pageNum);
                    const context = canvas.getContext('2d')!;
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    processImageData(imageData.data, doInvert, doMonochrome);
                    context.putImageData(imageData, 0, 0);

                    const pngImage = await finalDoc.embedPng(canvas.toDataURL('image/png'));
                    const newPage = finalDoc.addPage([canvas.width, canvas.height]);
                    newPage.drawImage(pngImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });
                } else {
                    const sourceDoc = await PDFDocument.load(buffer);
                    const [copiedPage] = await finalDoc.copyPages(sourceDoc, [pageNum - 1]);
                    finalDoc.addPage(copiedPage);
                }
            }
        } else {
            // N-up layout
            const A4 = PageSizes.A4;
            let newPageSize: [number, number], positions: {x:number, y:number}[], slotSize: {width:number, height:number};
            
            if (layout === 2) { // 2-up landscape
                newPageSize = [A4[1], A4[0]];
                slotSize = { width: newPageSize[0] / 2, height: newPageSize[1] };
                positions = [ { x: 0, y: 0 }, { x: slotSize.width, y: 0 } ];
            } else { // 3-up & 4-up portrait
                const slots = layout === 3 ? 3 : 4;
                newPageSize = [A4[0], A4[1]];
                slotSize = { width: newPageSize[0], height: newPageSize[1] / slots };
                positions = Array.from({length: slots}, (_, i) => ({ x: 0, y: slotSize.height * (slots - 1 - i) }));
            }
            
            for (let i = 0; i < totalSourcePages; i += layout) {
                if (isCancelled) break;
                updateProgress(i + 1, totalSourcePages, startTime);
                const newPage = finalDoc.addPage(newPageSize);
                const chunk = pagesToProcess.slice(i, i + layout);

                for (let j = 0; j < chunk.length; j++) {
                     if (isCancelled) break;
                    const { buffer, pageNum } = chunk[j];
                    const contentToDraw: PDFImage | PDFEmbeddedPage = isImageProcessingNeeded
                        ? await (async () => {
                            const canvas = await renderPageToCanvas(buffer, pageNum);
                            const context = canvas.getContext('2d')!;
                            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                            processImageData(imageData.data, doInvert, doMonochrome);
                            context.putImageData(imageData, 0, 0);
                            return await finalDoc.embedPng(canvas.toDataURL('image/png'));
                        })()
                        : await (async () => {
                            const sourceDoc = await PDFDocument.load(buffer);
                            const [embeddedPage] = await finalDoc.embedPages([sourceDoc.getPage(pageNum - 1)]);
                            return embeddedPage;
                        })();
                    
                    const size = 'width' in contentToDraw ? contentToDraw : contentToDraw.size();
                    const scale = Math.min(slotSize.width / size.width, slotSize.height / size.height);
                    const scaledWidth = size.width * scale;
                    const scaledHeight = size.height * scale;
                    
                    const tx = positions[j].x + (slotSize.width - scaledWidth) / 2;
                    const ty = positions[j].y + (slotSize.height - scaledHeight) / 2;

                    const drawOptions = { x: tx, y: ty, width: scaledWidth, height: scaledHeight };

                    if ('width' in contentToDraw) {
                        newPage.drawImage(contentToDraw, drawOptions);
                    } else {
                        newPage.drawPage(contentToDraw, drawOptions);
                    }
                }
            }
        }
        
        if (isCancelled) {
            statusLabel.textContent = 'Processing cancelled by user.';
            statusLabel.className = '';
            return;
        }

        updateProgress(totalSourcePages, totalSourcePages, startTime, 'Generating download...');
        const finalBytes = await finalDoc.save();
        
        const blob = new Blob([finalBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `processed-${Date.now()}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);

        statusLabel.textContent = 'PDF successfully processed!';
        statusLabel.className = 'success';

    } catch (e) {
        if (!isCancelled) {
            statusLabel.textContent = `Error: ${(e as Error).message}`;
            statusLabel.className = 'error';
            console.error(e);
        }
    } finally {
        isProcessing = false;
        document.body.classList.remove('processing');
        updateUI();
    }
}

function processImageData(data: Uint8ClampedArray, doInvert: boolean, doMonochrome: boolean) {
    // Helper for color conversion
    const rgbToHsv = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        const s = max === 0 ? 0 : d / max;
        return s * 100; // Return saturation percentage
    };
    
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];

        if (doInvert) {
            r = 255 - r; g = 255 - g; b = 255 - b;
        }

        if (doMonochrome) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const saturation = rgbToHsv(r, g, b);

            let final = 255; // Default white
            if (gray < 220) {
                final = 0; // High contrast
            }
            if (saturation > 40) { // Smart filter for colored regions
                final = 0; // Make colorful areas black...
                if (gray > 150) {
                    final = 255; // ...unless it's bright (e.g., white text on color)
                }
            }
            r = g = b = final;
        }
        data[i] = r; data[i+1] = g; data[i+2] = b;
    }
}

// Initial UI setup
updateUI();

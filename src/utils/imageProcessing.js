import heic2any from 'heic2any';

export const processImage = async (file) => {
    // Handle HEIC conversion
    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
        try {
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/png',
                quality: 0.8
            });
            // heic2any can return a Blob or an array of Blobs
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            file = new File([blob], file.name.replace(/\.heic$/i, '.png'), { type: 'image/png' });
        } catch (error) {
            console.error("HEIC conversion failed:", error);
            // Proceeding might fail, but let the standard loader try or fail gracefully
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Initial max dimension - Increased to 1024px for better quality
                const MAX_INITIAL_DIM = 1024;
                if (width > MAX_INITIAL_DIM || height > MAX_INITIAL_DIM) {
                    if (width > height) {
                        height *= MAX_INITIAL_DIM / width;
                        width = MAX_INITIAL_DIM;
                    } else {
                        width *= MAX_INITIAL_DIM / height;
                        height = MAX_INITIAL_DIM;
                    }
                }

                // Ensure integer dimensions
                width = Math.floor(width);
                height = Math.floor(height);

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Fill white background (transparency in PNGs becomes black in JPEG otherwise)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                
                ctx.drawImage(img, 0, 0, width, height);

                // Strict Limit: ~150KB to respect LocalStorage limits
                const MAX_STRING_LENGTH = 150 * 1024 * 1.37;

                // Strategy 1: Try PNG at full res
                let dataUrl = canvas.toDataURL('image/png');
                let quality = 0.9;
                let isJpeg = false;

                // Compression loop
                let attempts = 0;
                while (dataUrl.length > MAX_STRING_LENGTH && attempts < 10) {
                    // If PNG is too big, switch to JPEG immediately as it's much more efficient for photos
                    if (!isJpeg) {
                        isJpeg = true;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                        attempts++;
                        continue;
                    }

                    // If JPEG is still too big, lower quality slightly
                    if (quality > 0.6) {
                        quality -= 0.1;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                        attempts++;
                        continue;
                    }

                    // If quality is already low, gently reduce dimensions (10% step)
                    // This preserves visual detail much better than aggressive resizing
                    width = Math.floor(width * 0.9);
                    height = Math.floor(height * 0.9);
                    
                    if (width < 1) width = 1;
                    if (height < 1) height = 1;

                    canvas.width = width;
                    canvas.height = height;
                    
                    // Re-draw background and image
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                    attempts++;
                }

                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
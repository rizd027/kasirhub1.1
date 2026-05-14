export const uploadImage = async (file: File | string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'kasirhub_preset');

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlnd3fzty';
  
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { message: text };
    }
    
    if (!response.ok) {
      console.error('Cloudinary Upload Failed!');
      console.error('Status:', response.status);
      console.error('Status Text:', response.statusText);
      console.error('Response Body:', data);
      
      throw new Error(data.error?.message || data.message || `Status ${response.status}`);
    }

    return data.secure_url;
  } catch (error) {
    console.error('Network or Cloudinary Exception:', error);
    throw error;
  }
};

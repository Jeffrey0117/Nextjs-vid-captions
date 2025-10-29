const testAPI = async () => {
  try {
    const subtitles = [{
      startTime: 0,
      endTime: 3,
      text: '測試描邊字幕',
      style: {
        fontSize: 32,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#FFFFFF',
        enableStroke: true,
        strokeColor: '#000000',
        strokeWidth: 3,
        positionX: 50,
        positionY: 80
      }
    }];

    const formData = new FormData();
    formData.append('videoPath', 'test-video.mp4');
    formData.append('subtitles', JSON.stringify(subtitles));

    console.log('發送請求...');
    console.log('字幕資料:', JSON.stringify(subtitles, null, 2));

    const response = await fetch('/api/render-video/drawtext', {
      method: 'POST',
      body: formData
    });

    console.log('回應狀態:', response.status);
    console.log('回應標頭:', [...response.headers.entries()]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API 錯誤:', errorText);
      document.getElementById('result').innerHTML = `❌ API 錯誤 (${response.status}): ${errorText}`;
      return;
    }

    const blob = await response.blob();
    console.log('回應檔案大小:', blob.size, 'bytes');
    
    if (blob.size === 0) {
      document.getElementById('result').innerHTML = '❌ 回應檔案為空';
      return;
    }

    const url = URL.createObjectURL(blob);
    document.getElementById('result').innerHTML = `
      <p>✅ 成功！檔案大小: ${(blob.size / 1024 / 1024).toFixed(2)} MB</p>
      <video controls width="600">
        <source src="${url}" type="video/mp4">
      </video>
      <br><br>
      <a href="${url}" download="test-stroke.mp4">下載影片</a>
    `;

  } catch (error) {
    console.error('請求失敗:', error);
    document.getElementById('result').innerHTML = `❌ 請求失敗: ${error.message}`;
  }
};

// 呼叫測試
testAPI();
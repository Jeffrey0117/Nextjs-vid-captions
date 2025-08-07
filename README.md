# Subtitle Generator

> A modern web application for generating and displaying English subtitles with real-time video synchronization using Whisper AI.

## ✨ Features

- **AI-Powered Subtitle Generation**: Automatic English subtitle generation using OpenAI Whisper
- **Video Upload & Processing**: Upload your videos and get accurate subtitles
- **Real-time Subtitle Display**: Synchronized subtitle overlay with video playback
- **SRT Format Support**: Import and export standard SRT subtitle files
- **Interactive Timeline**: Click on any subtitle to jump to that moment in the video
- **Modern UI**: Clean, responsive design with smooth animations
- **Client-side Processing**: Fast and secure - everything runs in your browser

## 🚀 Prerequisites

Before you start, make sure you have:

### 1. Python 3.8+ 
```bash
python --version  # Should be 3.8 or higher
```

### 2. OpenAI Whisper
```bash
pip install openai-whisper
```

### 3. Node.js 16+
```bash
node --version  # Should be 16 or higher
```

## 📦 Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd subtitle-web
```

2. **Install Node.js dependencies**
```bash
npm install
# or
yarn install
```

3. **Install Python dependencies**
```bash
pip install openai-whisper ffmpeg-python
```

4. **Start the development server**
```bash
npm run dev
# or
yarn dev
```

5. **Open your browser**
Open [http://localhost:3000](http://localhost:3000) to start using the app.

## 🎯 How to Use

1. **Upload Video**: Drag and drop your video file or click to select
2. **Processing**: The app will use Whisper AI to generate subtitles automatically
3. **Review**: Watch your video with synchronized subtitles
4. **Export**: Download the generated subtitles as SRT file
5. **Edit**: Click on any subtitle in the timeline to jump to that moment

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **AI Processing**: OpenAI Whisper
- **Video Processing**: FFmpeg
- **Subtitle Format**: SRT Parser with time synchronization

## 🎨 UI Philosophy

Inspired by atomic CSS methodology, our design focuses on:
- **Minimal** - Clean interface without distractions
- **Functional** - Every element serves a purpose
- **Responsive** - Works seamlessly across all devices
- **Accessible** - Built with accessibility in mind

## 🔧 Core Components

- `VideoPlayer` - Custom video player with subtitle overlay
- `SubtitleBox` - Real-time subtitle display component
- `SRT Parser` - Handles subtitle file parsing and time synchronization
- `Upload Interface` - Drag-and-drop file upload with progress
- `Whisper Integration` - AI-powered subtitle generation

## 📋 Supported Formats

### Video Formats
- MP4, MOV, AVI, MKV, WebM
- Most common video codecs

### Audio Formats
- MP3, WAV, M4A, FLAC
- Any format supported by FFmpeg

### Output
- SRT (SubRip Subtitle) format
- WebVTT support (coming soon)

## ⚠️ Troubleshooting

### Whisper Installation Issues
```bash
# If you encounter issues with Whisper installation:
pip install --upgrade pip
pip install openai-whisper --upgrade

# For M1 Macs:
pip install openai-whisper --no-deps
```

### FFmpeg Issues
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### Performance Tips
- Use smaller video files for faster processing
- Whisper `base` model is fastest, `large` is most accurate
- Close other applications during processing

## Project Structure

```
/app
  └── page.tsx             # Main page with video upload and player
  └── components/
      ├── VideoPlayer.tsx  # Video player with subtitle rendering
      └── SubtitleBox.tsx  # Component for displaying subtitles
  └── api/
      └── transcribe/      # API route for video processing
          └── route.ts     
/lib
  ├── parseSrt.ts         # SRT parsing utilities
  └── types.ts            # TypeScript type definitions
/public
  └── temp/               # Temporary storage for uploaded files
```

## How It Works

1. Users can upload a video file through the web interface
2. The video is processed (currently a mock implementation)
3. The video player loads with sample subtitles
4. Subtitles are displayed in sync with the video playback

## Future Improvements

- Integrate with a real speech-to-text API (e.g., OpenAI Whisper)
- Allow users to upload their own SRT files
- Add subtitle editing capabilities
- Support multiple subtitle tracks
- Add video trimming functionality

## 🚀 Deployment

### Environment Variables
Create a `.env.local` file:
```bash
WHISPER_MODEL=base  # Options: tiny, base, small, medium, large
MAX_FILE_SIZE=100MB
```

### Build for Production
```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) for amazing AI transcription
- [Next.js](https://nextjs.org/) for the fantastic React framework
- [Tailwind CSS](https://tailwindcss.com/) for utility-first CSS

---

**Simple. Fast. Accessible.**  
Generate subtitles powered by AI that just work.

## 📞 Support

Having issues? Check our [troubleshooting guide](#-troubleshooting) or open an issue on GitHub.

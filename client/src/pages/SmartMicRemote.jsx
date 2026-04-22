import React, { useState, useRef, useEffect } from 'react';

// Mock student data for the grid
const STUDENTS = [
    { id: '1', name: 'jalal', avatar: '👨‍💻' },
    { id: '2', name: 'Student 2', avatar: '👩‍💻' },
    { id: '3', name: 'Student 3', avatar: '🧑‍💻' },
    { id: '4', name: 'Student 4', avatar: '👨‍🎓' },
    { id: '5', name: 'Student 5', avatar: '👩‍🎓' },
];

export default function SmartMicRemote() {
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [volumeLevel, setVolumeLevel] = useState(0); // Optional: visual mic feedback

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyzerRef = useRef(null);
    const animationFrameRef = useRef(null);

    // --- Timer logic ---
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
            setRecordingTime(0);
            setVolumeLevel(0);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
        return () => {
            clearInterval(timerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isRecording]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // --- Visual Mic Level ---
    const trackMicrophoneVolume = (stream) => {
        // Note: window.AudioContext may not be supported in all environments; ensure polyfills or checks
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        audioContextRef.current = new AudioContextClass();
        analyzerRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyzerRef.current);
        analyzerRef.current.fftSize = 256;
        const bufferLength = analyzerRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
            analyzerRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            setVolumeLevel(sum / bufferLength);
            animationFrameRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();
    };

    // --- Audio Engine ---
    const handleStartRecording = async () => {
        if (!selectedStudentId || isRecording) return;

        try {
            // EXACT constraints requested to bypass OS filtering and get raw stereo
            const constraints = {
                audio: {
                    channelCount: { exact: 2 },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
                video: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            trackMicrophoneVolume(stream);

            // Using MediaRecorder to handle chunking
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Build the final audio blob when recording stops
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                sendToBackend(audioBlob, selectedStudentId);

                // Turn off the microphone hardware indicator
                stream.getTracks().forEach((track) => track.stop());
                if (audioContextRef.current) audioContextRef.current.close();
            };

            mediaRecorder.start(1000); // 1-second chunks
            setIsRecording(true);

            // Haptic feedback if supported on mobile
            if (navigator.vibrate) navigator.vibrate(50);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            // Fallback or error UI handling (Mobile browsers might reject strict stereo constraints)
            alert("Microphone access failed. Ensure you are on HTTPS and your hardware supports stereo capture.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        }
    };

    // --- Data Dispatch ---
    const sendToBackend = (audioBlob, studentId) => {
        const student = STUDENTS.find((s) => s.id === studentId);
        console.log(`[WebSocket/POST Placeholder] Preparing to send recording for: ${student?.name}`);
        console.log(`Audio Blob Details: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

        // Example POST request:
        // const formData = new FormData();
        // formData.append('audio', audioBlob, 'answer.webm');
        // formData.append('studentId', studentId);
        //
        // fetch('https://your-api.com/process-audio', {
        //   method: 'POST',
        //   body: formData
        // }).then(res => res.json()).then(console.log);
    };

    return (
        <div className="flex flex-col h-full max-w-md mx-auto bg-gray-950 text-gray-100 font-sans shadow-2xl relative overflow-hidden rounded-lg">

            {/* Visual background pulse when recording */}
            {isRecording && (
                <div
                    className="absolute inset-0 bg-red-900/20 origin-center transition-transform duration-300 ease-out"
                    style={{ transform: `scale(${1 + Math.min(volumeLevel / 100, 0.5)})` }}
                />
            )}

            {/* Header */}
            <header className="relative z-10 px-6 pt-12 pb-6 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-white">Active Room</h1>
                    <p className="text-sm text-gray-400 mt-1">Select student to record</p>
                </div>

                {/* Status indicator */}
                <div className="flex items-center space-x-2">
                    {isRecording && (
                        <span className="text-red-500 font-mono text-lg font-medium tabular-nums shadow-red-500/20 drop-shadow-lg">
                            {formatTime(recordingTime)}
                        </span>
                    )}
                    <div className={`h-3 w-3 rounded-full shadow-lg transition-colors duration-300 ${isRecording ? 'bg-red-500 shadow-red-500/50 animate-pulse' : 'bg-gray-700'}`} />
                </div>
            </header>

            {/* Student Grid Container */}
            <main className="relative z-10 flex-1 px-4 py-6 overflow-y-auto w-full">
                <div className="grid grid-cols-2 gap-4">
                    {STUDENTS.map((student) => {
                        const isSelected = selectedStudentId === student.id;
                        return (
                            <button
                                key={student.id}
                                disabled={isRecording}
                                onClick={() => setSelectedStudentId(student.id)}
                                className={`
                  relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200 ease-in-out
                  ${isRecording ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}
                  ${isSelected
                                        ? 'bg-blue-600 shadow-lg shadow-blue-500/30 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950'
                                        : 'bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50'
                                    }
                  ${isSelected && isRecording ? '!opacity-100 ring-red-500 shadow-red-500/20' : ''}
                `}
                            >
                                <span className="text-4xl mb-3 block">{student.avatar}</span>
                                <span className={`text-sm font-medium w-full text-center ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                    {student.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </main>

            {/* Footer / Controls */}
            <footer className="relative z-10 p-6 bg-gray-950/90 backdrop-blur-lg border-t border-gray-800 pb-10 mt-auto">
                {!isRecording ? (
                    <button
                        onClick={handleStartRecording}
                        disabled={!selectedStudentId}
                        className={`
              w-full py-5 rounded-full text-lg font-semibold tracking-wide transition-all duration-300
              ${selectedStudentId
                                ? 'bg-white text-black hover:bg-gray-200 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)]'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }
            `}
                    >
                        {selectedStudentId ? 'Start Recording' : 'Select a student...'}
                    </button>
                ) : (
                    <button
                        onClick={handleStopRecording}
                        className="w-full py-5 rounded-full text-lg font-semibold tracking-wide bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all duration-300 flex items-center justify-center space-x-3"
                    >
                        <div className="w-4 h-4 rounded-sm bg-white" />
                        <span>Stop Recording</span>
                    </button>
                )}
            </footer>
        </div>
    );
}

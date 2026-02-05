import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';

interface AudioRecorderProps {
    onAudioRecorded: (audioBlob: Blob) => void;
    onCancel: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioRecorded, onCancel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        startRecording();

        return () => {
            stopRecordingInternal();
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            onCancel(); // Cancel if permission denied or error
        }
    };

    const stopRecordingInternal = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRecording(false);
    };

    const handleStopAndSend = () => {
        if (!mediaRecorderRef.current) return;

        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); // Chrome/Firefox record in webm/ogg
            onAudioRecorded(blob);
        };
        stopRecordingInternal();
    };

    const handleCancel = () => {
        stopRecordingInternal();
        onCancel();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-2 py-1 animate-fade-in">
            <div className="flex-1 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-slate-700 dark:text-slate-200 font-mono text-sm">
                    {formatTime(recordingTime)}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={handleCancel}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                <button
                    onClick={handleStopAndSend}
                    className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full transition-colors shadow-sm"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

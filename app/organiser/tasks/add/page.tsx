'use client';

import { useEffect, useRef, useState } from 'react';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createNotificationForMany } from '@/lib/notifications';

type AttachmentType = 'image' | 'pdf' | 'audio' | 'video';
interface Attachment {
  file: File;
  previewUrl: string;
  type: AttachmentType;
  name: string;
}

const VIDEO_LIMIT = 40;

export default function AddTaskPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [organisers, setOrganisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      const user = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      setUserData(user);

      const orgQ = query(collection(db, 'shivirOrganisers'), where('phone', '==', currentUser.phoneNumber));
      const orgSnap = await getDocs(orgQ);
      if (!orgSnap.empty) {
        const shivirId = orgSnap.docs[0].data().shivirId;
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });
          const allOrgQ = query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId));
          const allOrgSnap = await getDocs(allOrgQ);
          setOrganisers(allOrgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleAssign = (phone: string) => {
    setAssignedTo(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  // ─── File attachment handlers ─────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: AttachmentType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAttachments(prev => [...prev, { file, previewUrl, type, name: file.name }]);
    e.target.value = '';
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const name = `voice_${Date.now()}.webm`;
        const file = new File([blob], name, { type: 'audio/webm' });
        setAttachments(prev => [...prev, { file, previewUrl: URL.createObjectURL(blob), type: 'audio', name }]);
        stream.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingAudio(true);
      setRecordTimer(0);
      timerRef.current = setInterval(() => setRecordTimer(s => s + 1), 1000);
    } catch {
      alert('Could not access microphone. Please allow microphone permission.');
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play();
      }
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const name = `video_${Date.now()}.webm`;
        const file = new File([blob], name, { type: 'video/webm' });
        setAttachments(prev => [...prev, { file, previewUrl: URL.createObjectURL(blob), type: 'video', name }]);
        stream.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingVideo(true);
      setRecordTimer(0);
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setRecordTimer(elapsed);
        if (elapsed >= VIDEO_LIMIT) stopRecording();
      }, 1000);
    } catch {
      alert('Could not access camera/microphone. Please allow permissions.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setRecordingAudio(false);
    setRecordingVideo(false);
    setRecordTimer(0);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ─── Save task ────────────────────────────────────────────

  const saveTask = async () => {
    setMessage('');
    if (!title.trim()) { setMessage('Please enter task title'); return; }
    if (assignedTo.length === 0) { setMessage('Please assign to at least one Aayojak'); return; }

    setSaving(true);
    try {
      // Upload attachments to Firebase Storage
      const uploadedAttachments = await Promise.all(
        attachments.map(async (att) => {
          const fileRef = storageRef(storage, `tasks/${shivir.id}/${Date.now()}_${att.name}`);
          await uploadBytes(fileRef, att.file);
          const url = await getDownloadURL(fileRef);
          return { url, type: att.type, name: att.name };
        })
      );

      const assignedToNames = organisers
        .filter(o => assignedTo.includes(o.phone))
        .map(o => o.name);

      await addDoc(collection(db, 'tasks'), {
        shivirId: shivir.id,
        shivirName: shivir.name,
        title: title.trim(),
        description: description.trim(),
        deadline,
        priority,
        assignedTo,
        assignedToNames,
        attachments: uploadedAttachments,
        status: 'todo',
        createdBy: userData.phone,
        createdByName: userData.name,
        createdAt: serverTimestamp(),
      });

      setMessage('✅ Task created successfully!');

      try {
        const othersToNotify = assignedTo.filter(p => p !== userData.phone);
        if (othersToNotify.length > 0) {
          await createNotificationForMany({
            phones: othersToNotify,
            title: '✅ New Task Assigned',
            body: `${userData.name} assigned you: "${title.trim()}" — ${priority} priority`,
            type: 'task_assigned',
            shivirId: shivir.id,
          });
        }
      } catch (e) {}

      setTimeout(() => {
        window.location.href = '/organiser/tasks';
      }, 1500);

    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/organiser/tasks'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">✅ Add Task</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          {/* Title */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">Task Title *</label>
            <input type="text" placeholder="e.g. Book the hall, Arrange prasad"
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">Description (Optional)</label>
            <textarea placeholder="Any details about this task..."
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          {/* Attachments */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-2">
              Attachments (Optional)
              {attachments.length > 0 && <span className="text-orange-500 ml-1 text-xs">{attachments.length} added</span>}
            </label>

            {/* Add buttons */}
            {!recordingAudio && !recordingVideo && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                <button type="button" onClick={() => imageInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors">
                  <span className="text-xl">📷</span>
                  Photo
                </button>
                <button type="button" onClick={() => pdfInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
                  <span className="text-xl">📄</span>
                  PDF
                </button>
                <button type="button" onClick={startAudioRecording}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 transition-colors">
                  <span className="text-xl">🎙️</span>
                  Voice
                </button>
                <button type="button" onClick={startVideoRecording}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-purple-50 text-purple-600 text-xs font-medium hover:bg-purple-100 transition-colors">
                  <span className="text-xl">🎥</span>
                  Video
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => handleFileSelect(e, 'image')} />
            <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => handleFileSelect(e, 'pdf')} />

            {/* Audio recording UI */}
            {recordingAudio && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                <span className="text-green-600 text-lg animate-pulse">🎙️</span>
                <div className="flex-1">
                  <p className="text-green-700 text-sm font-medium">Recording voice note...</p>
                  <p className="text-green-600 text-xs">{recordTimer}s</p>
                </div>
                <button type="button" onClick={stopRecording}
                  className="bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-lg">
                  Stop
                </button>
              </div>
            )}

            {/* Video recording UI */}
            {recordingVideo && (
              <div className="mb-3">
                <video ref={liveVideoRef} muted autoPlay playsInline
                  className="w-full rounded-xl bg-black mb-2" style={{ maxHeight: 200 }} />
                <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <span className="text-purple-600 text-lg animate-pulse">🎥</span>
                  <div className="flex-1">
                    <p className="text-purple-700 text-sm font-medium">Recording video...</p>
                    <p className="text-purple-600 text-xs">
                      {recordTimer}s / {VIDEO_LIMIT}s
                      {recordTimer >= VIDEO_LIMIT - 5 && recordTimer < VIDEO_LIMIT && (
                        <span className="text-red-500 ml-1 font-bold">stopping soon</span>
                      )}
                    </p>
                  </div>
                  <button type="button" onClick={stopRecording}
                    className="bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-lg">
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-200">
                    {att.type === 'image' && (
                      <img src={att.previewUrl} alt="attachment"
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    {att.type === 'pdf' && (
                      <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 text-2xl">📄</div>
                    )}
                    {att.type === 'audio' && (
                      <audio controls src={att.previewUrl} className="flex-1 h-10" />
                    )}
                    {att.type === 'video' && (
                      <video controls src={att.previewUrl} className="flex-1 rounded-lg" style={{ maxHeight: 120 }} />
                    )}
                    {att.type !== 'audio' && att.type !== 'video' && (
                      <p className="flex-1 text-xs text-gray-600 truncate">{att.name}</p>
                    )}
                    <button type="button" onClick={() => removeAttachment(i)}
                      className="text-red-400 hover:text-red-600 font-bold text-lg px-1 flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-2">Priority *</label>
            <div className="flex gap-2">
              {[
                { key: 'high', label: '🔴 High', color: 'bg-red-500' },
                { key: 'medium', label: '🟡 Medium', color: 'bg-yellow-500' },
                { key: 'low', label: '🟢 Low', color: 'bg-green-500' },
              ].map(p => (
                <button key={p.key} onClick={() => setPriority(p.key as any)}
                  className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${
                    priority === p.key ? `${p.color} text-white` : 'bg-orange-50 text-gray-600'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Deadline with date + time */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">Deadline (Optional)</label>
            <input type="datetime-local" value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          {/* Assign To */}
          <div className="mb-6">
            <label className="block text-gray-600 text-sm font-medium mb-2">
              Assign To * ({assignedTo.length} selected)
            </label>
            <div className="space-y-2">
              {organisers.map((org: any) => (
                <button key={org.phone} onClick={() => toggleAssign(org.phone)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                    assignedTo.includes(org.phone)
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-orange-300'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      assignedTo.includes(org.phone) ? 'bg-orange-500' : 'bg-gray-300'
                    }`}>
                      {org.name?.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-700 text-sm">{org.name}</p>
                      <p className="text-gray-400 text-xs">{org.phone}</p>
                    </div>
                  </div>
                  {assignedTo.includes(org.phone) && (
                    <span className="text-orange-500 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <p className={`text-sm mb-4 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}

          <button onClick={saveTask} disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : '✅ Create Task'}
          </button>

        </div>
      </div>
    </div>
  );
}

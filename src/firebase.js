import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  enableIndexedDbPersistence,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBclcrpD0itGZhi8C8Q0EJ31lK6det8ItA",
  authDomain: "crm-dezign.firebaseapp.com",
  projectId: "crm-dezign",
  storageBucket: "crm-dezign.firebasestorage.app",
  messagingSenderId: "1083083582242",
  appId: "1:1083083582242:web:4304647ff0d5cb99ac537b",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

enableIndexedDbPersistence(db).catch(() => {})

export function subscribeProjects(callback) {
  return onSnapshot(collection(db, 'projects'), (snap) => {
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(projects)
  })
}

export function subscribeProject(projectId, callback) {
  return onSnapshot(doc(db, 'projects', projectId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
    else callback(null)
  })
}

export async function saveProject(project) {
  const { id, ...data } = project
  await setDoc(doc(db, 'projects', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function patchProject(projectId, partial) {
  await updateDoc(doc(db, 'projects', projectId), {
    ...partial,
    updatedAt: serverTimestamp(),
  })
}

export async function createProject(data) {
  const id = 'proj_' + Math.random().toString(36).slice(2, 10)
  await setDoc(doc(db, 'projects', id), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return id
}

export async function deleteProject(projectId) {
  await deleteDoc(doc(db, 'projects', projectId))
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────
const CLOUD_NAME = "dlbimoztd"
const UPLOAD_PRESET = "studio_renders"

export function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", UPLOAD_PRESET)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress && onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve(data.secure_url)
      } else {
        reject(new Error("Upload failed"))
      }
    }

    xhr.onerror = () => reject(new Error("Network error"))
    xhr.send(formData)
  })
}
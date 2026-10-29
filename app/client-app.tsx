"use client";
import dynamic from "next/dynamic";
const Application = dynamic(() => import("./application"), { ssr: false });
export default function ClientApp() { return <Application />; }

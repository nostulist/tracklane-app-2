import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import Tracker from "./Tracker";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: "#0B0B0D", minHeight: "100vh" }} />
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <Tracker
      userId={session.user.id}
      userEmail={session.user.email}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}

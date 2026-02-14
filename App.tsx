import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { GlobalContextProviders } from "./components/_globalContextProviders";
import Page_0 from "./pages/login.tsx";
import PageLayout_0 from "./pages/login.pageLayout.tsx";
import Page_1 from "./pages/_index.tsx";
import PageLayout_1 from "./pages/_index.pageLayout.tsx";
import Page_2 from "./pages/ebooks.tsx";
import PageLayout_2 from "./pages/ebooks.pageLayout.tsx";
import Page_3 from "./pages/courses.tsx";
import PageLayout_3 from "./pages/courses.pageLayout.tsx";
import Page_4 from "./pages/schedule.tsx";
import PageLayout_4 from "./pages/schedule.pageLayout.tsx";
import Page_5 from "./pages/dashboard.tsx";
import PageLayout_5 from "./pages/dashboard.pageLayout.tsx";
import Page_6 from "./pages/instructors.tsx";
import PageLayout_6 from "./pages/instructors.pageLayout.tsx";
import Page_7 from "./pages/complete-registration.tsx";
import PageLayout_7 from "./pages/complete-registration.pageLayout.tsx";
import Page_8 from "./pages/courses.$courseId.enroll.tsx";
import PageLayout_8 from "./pages/courses.$courseId.enroll.pageLayout.tsx";
import Page_9 from "./pages/admin.tsx";
import PageLayout_9 from "./pages/admin.pageLayout.tsx";

if (!window.requestIdleCallback) {
  window.requestIdleCallback = (cb) => {
    setTimeout(cb, 1);
  };
}

import "./base.css";

const fileNameToRoute = new Map([["./pages/login.tsx","/login"],["./pages/_index.tsx","/"],["./pages/ebooks.tsx","/ebooks"],["./pages/courses.tsx","/courses"],["./pages/schedule.tsx","/schedule"],["./pages/dashboard.tsx","/dashboard"],["./pages/instructors.tsx","/instructors"],["./pages/complete-registration.tsx","/complete-registration"],["./pages/courses.$courseId.enroll.tsx","/courses/:courseId/enroll"],["./pages/admin.tsx","/admin"]]);
const fileNameToComponent = new Map([
    ["./pages/login.tsx", Page_0],
["./pages/_index.tsx", Page_1],
["./pages/ebooks.tsx", Page_2],
["./pages/courses.tsx", Page_3],
["./pages/schedule.tsx", Page_4],
["./pages/dashboard.tsx", Page_5],
["./pages/instructors.tsx", Page_6],
["./pages/complete-registration.tsx", Page_7],
["./pages/courses.$courseId.enroll.tsx", Page_8],
["./pages/admin.tsx", Page_9],
  ]);

function makePageRoute(filename: string) {
  const Component = fileNameToComponent.get(filename);
  return <Component />;
}

function toElement({
  trie,
  fileNameToRoute,
  makePageRoute,
}: {
  trie: LayoutTrie;
  fileNameToRoute: Map<string, string>;
  makePageRoute: (filename: string) => React.ReactNode;
}) {
  return [
    ...trie.topLevel.map((filename) => (
      <Route
        key={fileNameToRoute.get(filename)}
        path={fileNameToRoute.get(filename)}
        element={makePageRoute(filename)}
      />
    )),
    ...Array.from(trie.trie.entries()).map(([Component, child], index) => (
      <Route
        key={index}
        element={
          <Component>
            <Outlet />
          </Component>
        }
      >
        {toElement({ trie: child, fileNameToRoute, makePageRoute })}
      </Route>
    )),
  ];
}

type LayoutTrieNode = Map<
  React.ComponentType<{ children: React.ReactNode }>,
  LayoutTrie
>;
type LayoutTrie = { topLevel: string[]; trie: LayoutTrieNode };
function buildLayoutTrie(layouts: {
  [fileName: string]: React.ComponentType<{ children: React.ReactNode }>[];
}): LayoutTrie {
  const result: LayoutTrie = { topLevel: [], trie: new Map() };
  Object.entries(layouts).forEach(([fileName, components]) => {
    let cur: LayoutTrie = result;
    for (const component of components) {
      if (!cur.trie.has(component)) {
        cur.trie.set(component, {
          topLevel: [],
          trie: new Map(),
        });
      }
      cur = cur.trie.get(component)!;
    }
    cur.topLevel.push(fileName);
  });
  return result;
}

function NotFound() {
  return (
    <div>
      <h1>Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>Go back to the <a href="/" style={{ color: 'blue' }}>home page</a>.</p>
    </div>
  );
}

import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "REPLACE" | "POP"

  useEffect(() => {
    // Back/forward: keep browser-like behavior
    if (navType === "POP") return;

    // Hash links: let the browser scroll to the anchor
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, hash, navType]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <GlobalContextProviders>
        <Routes>
          {toElement({ trie: buildLayoutTrie({
"./pages/login.tsx": PageLayout_0,
"./pages/_index.tsx": PageLayout_1,
"./pages/ebooks.tsx": PageLayout_2,
"./pages/courses.tsx": PageLayout_3,
"./pages/schedule.tsx": PageLayout_4,
"./pages/dashboard.tsx": PageLayout_5,
"./pages/instructors.tsx": PageLayout_6,
"./pages/complete-registration.tsx": PageLayout_7,
"./pages/courses.$courseId.enroll.tsx": PageLayout_8,
"./pages/admin.tsx": PageLayout_9,
}), fileNameToRoute, makePageRoute })} 
          <Route path="*" element={<NotFound />} />
        </Routes>
      </GlobalContextProviders>
    </BrowserRouter>
  );
}

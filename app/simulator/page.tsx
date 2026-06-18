import fs from "fs";
import path from "path";
import SimulatorClient from "./SimulatorClient";

function loadDir(dir: string) {
  const full = path.join(process.cwd(), "lib/data", dir);
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(full, f), "utf8")))
    .sort((a, b) => (a.name as string).localeCompare(b.name as string));
}

export default function SimulatorPage() {
  const colleges = loadDir("colleges");
  const students = loadDir("students");
  const seniors = students.filter((s) => s.year === "senior");
  return <SimulatorClient colleges={colleges} students={students} seniors={seniors} />;
}

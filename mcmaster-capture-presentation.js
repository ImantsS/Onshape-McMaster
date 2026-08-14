window.captureMcMaster = async (name, delay = 150, scroller) => {
  const text = (element) => (element.innerText || "").replace(/\s+/g, " ").trim();
  const pattern = /\b\d{3,7}[A-Z]\d{1,5}\b/g;
  const parts = new Map();
  const headings = new Set();

  const scan = () => {
    document.querySelectorAll("h1,h2,h3,h4").forEach((heading) => headings.add(text(heading)));
    document.querySelectorAll("table").forEach((table, tableIndex) => {
      let context = [];
      [...table.rows].forEach((row, rowIndex) => {
        const cells = [...row.cells].map(text);
        const numbers = [...new Set(cells.join(" ").match(pattern) || [])];
        if (!numbers.length) {
          if (cells.some(Boolean)) context = [...context, cells].slice(-10);
          return;
        }
        numbers.forEach((partNumber) => {
          const previous = parts.get(partNumber);
          if (!previous || context.length > previous.context.length) parts.set(partNumber, {
            partNumber, tableIndex, rowIndex, context, cells
          });
        });
      });
    });
  };

  scroller ||= [document.scrollingElement, ...document.querySelectorAll("div,main,section")]
    .filter((element) => element && element.clientHeight > 100 && (
      element === document.scrollingElement || /auto|scroll/.test(getComputedStyle(element).overflowY)
    ))
    .sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight))[0];

  for (let position = 0; ;) {
    scroller.scrollTop = position;
    await new Promise((resolve) => setTimeout(resolve, delay));
    scan();
    const maximum = scroller.scrollHeight - scroller.clientHeight;
    if (position >= maximum) break;
    position = Math.min(maximum, position + scroller.clientHeight * 0.9);
  }
  scroller.scrollTop = 0;

  const data = {
    name,
    url: location.href,
    title: document.title,
    headings: [...headings].filter(Boolean),
    parts: [...parts.values()]
  };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + "\n"]));
  link.download = `${name}.json`;
  link.click();
  console.log(`${name}: ${parts.size} part numbers`);
  return data;
};

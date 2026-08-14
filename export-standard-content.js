(async () => {
  const get = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status);
    return response.json();
  };
  const save = (name, data) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data)]));
    link.download = name;
    link.click();
  };

  const catalog = await get("/api/v16/standardcontent/list");
  save("catalog.json", catalog);

  for (const { id } of catalog) {
    try {
      save(`${id}.json`, await get(`/api/v16/standardcontent/d/${id}/parametervalues`));
    } catch (error) {
      console.error(id, error);
    }
  }
})();
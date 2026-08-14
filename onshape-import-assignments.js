/* Run once as a DevTools Snippet on cad.onshape.com, then call MCM_IMPORT(). */
window.MCM_IMPORT = async function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  const file = await new Promise((resolve) => {
    input.onchange = () => resolve(input.files[0]);
    input.click();
  });
  const data = JSON.parse(await file.text());
  if (!confirm(`Assign ${data.assignments.length} part numbers?`)) return;

  const token = decodeURIComponent(
    document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)[1]
  );
  const specifiers = data.assignments.map(({ parameters, partNumber }) => ({
    parameters: Object.entries(parameters).map(([parameterId, value]) => ({
      parameterId,
      value,
    })),
    customParameters: [{
      propertyId: "57f3fb8efa3416c06701d60f",
      value: partNumber,
    }],
  }));

  const batchSize = 100;
  const failures = [];
  const send = async (batch) => {
    const response = await fetch(
      `/api/v16/standardcontent/d/${data.familyId}/customparameters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": token,
        },
        body: JSON.stringify({ specifiers: batch }),
      }
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
    const body = text ? JSON.parse(text) : [];
    return Array.isArray(body) ? body : body.responses || [];
  };
  const fixLength = (specifier, result) => {
    const match = String(result.errorMessage).match(
      /\b(LengthId|ThreadLengthId) should be one of:\s*(.+)/
    );
    if (result.error !== "INVALID_PARAMETER_VALUE" || !match) return false;
    const parameter = specifier.parameters.find((item) => item.parameterId === match[1]);
    if (!parameter) return false;
    const nearest = match[2].split(",")
      .map((value) => ({ value: value.trim(), difference: Math.abs(Number(value) - Number(parameter.value)) }))
      .filter((item) => Number.isFinite(item.difference))
      .sort((a, b) => a.difference - b.difference)[0];
    if (!nearest || nearest.difference > 0.0051 || nearest.value === String(parameter.value)) return false;
    console.warn(`${parameter.parameterId}: ${parameter.value} -> ${nearest.value}`);
    parameter.value = nearest.value;
    return true;
  };

  for (let i = 0; i < specifiers.length; i += batchSize) {
    let pending = specifiers.slice(i, i + batchSize);
    for (let attempt = 0; pending.length && attempt < 3; attempt++) {
      const results = await send(pending);
      pending = pending.filter((specifier, index) => {
        const result = results[index] || { error: "NO_RESPONSE" };
        if (!result.error || result.error === "NONE") return false;
        if (attempt < 2 && fixLength(specifier, result)) return true;
        failures.push({ partNumber: specifier.customParameters[0].value, ...result });
        return false;
      });
    }
    console.log(`${Math.min(i + batchSize, specifiers.length)}/${specifiers.length}`);
  }
  console.log(`Finished with ${failures.length} failures`, failures);
};

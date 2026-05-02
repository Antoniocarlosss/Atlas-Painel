/* ==========================================================
   ATLAS - FIREBASE ORGANIZADO
   Arquivo: firebase-atlas.js
   ========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
   getFirestore,
doc,
getDoc,
getDocs,
collection,
setDoc,
deleteDoc,
serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCpSrCxE4UR4b1TMV54PVaIJk-VfKqGYdI",
    authDomain: "atlas-painel.firebaseapp.com",
    projectId: "atlas-painel",
    storageBucket: "atlas-painel.firebasestorage.app",
    messagingSenderId: "90696632690",
    appId: "1:90696632690:web:764621e567f390e0e9f5eb",
    measurementId: "G-FDS3MKMB4X"
};

const atlasFirebaseApp = initializeApp(firebaseConfig);
const atlasFirestore = getFirestore(atlasFirebaseApp);

let atlasFirebaseBloqueado = false;
let atlasFirebaseTimer = null;
let atlasFirebaseUltimaAlteracaoLocal = 0;
const ATLAS_FIREBASE_SYNC_KEY = "atlas_sync_local_updated_ms";

function atlasFirebaseNomeUsuario() {
    return document.getElementById("user-display")?.innerText || "SEM USUARIO";
}

function atlasParseJSON(chave, fallback) {
    try {
        return JSON.parse(localStorage.getItem(chave)) ?? fallback;
    } catch (erro) {
        return fallback;
    }
}

function atlasFirebaseChaveSincronizada(chave) {
    return chave && (chave.startsWith("atlas_") || chave === "historicoBobines");
}

function atlasFirebaseMesclarUsuario(local, nuvem) {
    if (!local) return nuvem;
    if (!nuvem) return local;

    if (local.bloqueado === true && nuvem.bloqueado !== true) {
        return { ...nuvem, bloqueado: true, _atlasUsuarioAtualizadoEm: Date.now() };
    }

    const localAtualizado = Number(local._atlasUsuarioAtualizadoEm || 0);
    const nuvemAtualizado = Number(nuvem._atlasUsuarioAtualizadoEm || 0);

    if (localAtualizado > nuvemAtualizado) return local;
    if (nuvemAtualizado > localAtualizado) return nuvem;

    return nuvem;
}

function atlasUsuariosExcluidosFirebase() {
    const excluidos = atlasParseJSON("atlas_usuarios_excluidos", {});
    return excluidos && typeof excluidos === "object" ? excluidos : {};
}

function atlasUsuarioFoiExcluidoFirebase(idUsuario) {
    const id = String(idUsuario || "").trim().toLowerCase();
    return Boolean(id && atlasUsuariosExcluidosFirebase()[id]);
}

async function atlasFirebaseBaixarUsuariosExcluidosDireto() {
    const snap = await getDocs(collection(atlasFirestore, "usuarios_excluidos"));
    const excluidosLocais = atlasUsuariosExcluidosFirebase();
    let mudou = false;

    snap.docs.forEach(d => {
        const dados = d.data() || {};
        const id = String(dados.id || d.id || "").trim().toLowerCase();
        if (!id) return;

        const localAtualizado = Number(excluidosLocais[id]?.atualizadoEm || 0);
        const nuvemAtualizado = Number(dados.atualizadoEm || 0);
        if (!excluidosLocais[id] || nuvemAtualizado >= localAtualizado) {
            excluidosLocais[id] = {
                id: dados.id || id,
                nome: dados.nome || dados.id || id,
                cargo: dados.cargo || "",
                excluidoPor: dados.excluidoPor || "SISTEMA",
                excluidoEm: dados.excluidoEm || "",
                atualizadoEm: nuvemAtualizado || Date.now()
            };
            mudou = true;
        }
    });

    if (mudou) {
        atlasFirebaseBloqueado = true;
        atlasLocalStorageSetItemOriginal.call(localStorage, "atlas_usuarios_excluidos", JSON.stringify(excluidosLocais));
        atlasFirebaseBloqueado = false;
    }

    return excluidosLocais;
}

async function atlasEnviarUsuariosExcluidos() {
    const excluidos = atlasUsuariosExcluidosFirebase();
    await Promise.all(Object.keys(excluidos).map(id => {
        const dados = excluidos[id] || {};
        return atlasSetDoc(["usuarios_excluidos", atlasDocId(id)], {
            ...dados,
            id: dados.id || id,
            atualizadoEm: Number(dados.atualizadoEm || Date.now())
        });
    }));
}

function atlasFirebaseMarcarAlteracaoLocal() {
    const agora = Date.now();
    atlasFirebaseUltimaAlteracaoLocal = agora;
    atlasLocalStorageSetItemOriginal.call(localStorage, ATLAS_FIREBASE_SYNC_KEY, String(agora));
}

function atlasFirebaseBackupPodeEntrar(dados) {
    const nuvem = Number(dados?.[ATLAS_FIREBASE_SYNC_KEY] || 0);
    const local = Number(localStorage.getItem(ATLAS_FIREBASE_SYNC_KEY) || 0);
    if (!local) return true;
    if (!nuvem) return false;
    return nuvem > local;
}

function atlasDocId(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w.-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 120) || String(Date.now());
}

function atlasDataPartes(dataBR) {
    const [dia, mes, ano] = String(dataBR || "").split("/");
    return {
        dia: Number(dia) || null,
        mes: Number(mes) || null,
        ano: Number(ano) || null
    };
}

async function atlasSetDoc(caminho, dados) {
    await setDoc(doc(atlasFirestore, ...caminho), {
        ...dados,
        atualizadoPor: atlasFirebaseNomeUsuario(),
        atualizadoEm: serverTimestamp()
    }, { merge: true });
}

async function atlasLimparColecao(nomeColecao) {
    const snap = await getDocs(collection(atlasFirestore, nomeColecao));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

async function atlasFirebaseRemoverUsuarioExcluidoDaNuvem(idUsuario) {
    const id = atlasDocId(idUsuario);
    if (!id) return;
    const excluidos = atlasUsuariosExcluidosFirebase();
    const idNormalizado = String(idUsuario || "").trim().toLowerCase();
    const dadosExclusao = excluidos[idNormalizado] || {
        id: idUsuario,
        nome: idUsuario,
        cargo: "",
        excluidoPor: atlasFirebaseNomeUsuario(),
        excluidoEm: new Date().toLocaleString("pt-BR"),
        atualizadoEm: Date.now()
    };
    await atlasSetDoc(["usuarios_excluidos", id], {
        ...dadosExclusao,
        id: dadosExclusao.id || idUsuario,
        atualizadoEm: Number(dadosExclusao.atualizadoEm || Date.now())
    });
    await deleteDoc(doc(atlasFirestore, "usuarios", id)).catch(erro => {
        console.warn("Nao foi possivel remover usuario excluido da nuvem:", erro);
    });
}

async function atlasFirebaseLimparUsuarioExcluidoDaNuvem(idUsuario) {
    const id = atlasDocId(idUsuario);
    if (!id) return;
    await deleteDoc(doc(atlasFirestore, "usuarios_excluidos", id)).catch(erro => {
        console.warn("Nao foi possivel limpar usuario excluido da nuvem:", erro);
    });
}

async function atlasEnviarUsuarios() {
    const usuarios = atlasParseJSON("atlas_usuarios", []).filter(usuario => !atlasUsuarioFoiExcluidoFirebase(usuario?.id));
    await atlasLimparColecao("usuarios");

    await Promise.all(usuarios.map(usuario => {
        const id = atlasDocId(usuario.id);
        return atlasSetDoc(["usuarios", id], {
            ...usuario,
            id: usuario.id,
            senha: usuario.senha,
            cargo: usuario.cargo,
            bloqueado: usuario.bloqueado === true
        });
    }));
}

async function atlasFirebaseBaixarUsuariosDireto() {
    const snap = await getDocs(collection(atlasFirestore, "usuarios"));
    const excluidos = await atlasFirebaseBaixarUsuariosExcluidosDireto();
    const usuariosNuvem = snap.docs
        .map(d => d.data())
        .filter(usuario => usuario && usuario.id && !excluidos[String(usuario.id).toLowerCase()]);

    const usuariosAtuais = atlasParseJSON("atlas_usuarios", []);
    const mapaMesclado = new Map();

    usuariosAtuais.forEach(usuario => {
        if (usuario && usuario.id) {
            const chaveUsuario = String(usuario.id).toLowerCase();
            if (!excluidos[chaveUsuario]) mapaMesclado.set(chaveUsuario, usuario);
        }
    });

    usuariosNuvem.forEach(usuario => {
        const chaveUsuario = String(usuario.id).toLowerCase();
        mapaMesclado.set(chaveUsuario, atlasFirebaseMesclarUsuario(mapaMesclado.get(chaveUsuario), usuario));
    });

    if (!mapaMesclado.has("admin")) {
        mapaMesclado.set("admin", { id: "admin", nome: "ADMIN", senha: "123", cargo: "admin", bloqueado: false });
    }

    const usuariosMesclados = Array.from(mapaMesclado.values());

    usuariosMesclados.sort((a, b) => {
        const adminA = String(a.id).toLowerCase() === "admin" ? -1 : 0;
        const adminB = String(b.id).toLowerCase() === "admin" ? -1 : 0;
        if (adminA !== adminB) return adminA - adminB;
        return String(a.id).localeCompare(String(b.id));
    });

    if (JSON.stringify(usuariosAtuais) === JSON.stringify(usuariosMesclados)) return false;

    atlasFirebaseBloqueado = true;
    atlasLocalStorageSetItemOriginal.call(localStorage, "atlas_usuarios", JSON.stringify(usuariosMesclados));
    atlasFirebaseBloqueado = false;

    if (typeof window.usuariosSistema !== "undefined") {
        window.usuariosSistema = usuariosMesclados;
    }
    if (typeof usuariosSistema !== "undefined") {
        usuariosSistema = usuariosMesclados;
    }

    return true;
}

async function atlasEnviarInjecao() {
    const db = atlasParseJSON("atlas_db", {});
    await atlasLimparColecao("injecao");

    const promessas = [];

    Object.keys(db).forEach(ano => {
        Object.keys(db[ano] || {}).forEach(mesNome => {
            (db[ano][mesNome] || []).forEach((rel, index) => {
                if (rel.modulo !== "injecao") return;

                const id = atlasDocId(`${ano}_${mesNome}_${rel.data}_${index}`);
                promessas.push(atlasSetDoc(["injecao", id], {
                    id,
                    ano: Number(ano),
                    mesNome,
                    data: rel.data,
                    operador: rel.operador,
                    totalMetros: (rel.itens || []).reduce((acc, item) => acc + Number(item.metros || 0), 0),
                    itens: rel.itens || [],
                    editadoPor: rel.editadoPor || "",
                    editadoEm: rel.editadoEm || "",
                    historicoEdicoes: rel.historicoEdicoes || []
                }));
            });
        });
    });

    await Promise.all(promessas);
}

async function atlasEnviarBobines() {
    const historico = atlasParseJSON("historicoBobines", []);
    await atlasLimparColecao("bobines");

    await Promise.all(historico.map((rel, index) => {
        const id = atlasDocId(rel.id || `${rel.data}_${index}`);
        return atlasSetDoc(["bobines", id], {
            id,
            data: rel.data,
            dia: rel.dia || null,
            mes: rel.mes || null,
            ano: rel.ano || null,
            hora: rel.hora || "",
            operador: rel.operador || "",
            totalProducoes: Array.from(new Set((rel.itens || []).map(item => item.producao))).length,
            itens: rel.itens || [],
            editadoPor: rel.editadoPor || "",
            editadoEm: rel.editadoEm || "",
            historicoEdicoes: rel.historicoEdicoes || []
        });
    }));
}

async function atlasEnviarCorte(nomeColecao, chaveLocalStorage) {
    const historico = atlasParseJSON(chaveLocalStorage, []);
    await atlasLimparColecao(nomeColecao);

    await Promise.all(historico.map((rel, index) => {
        const partes = rel.ano ? {} : atlasDataPartes(rel.data);
        const id = atlasDocId(rel.id || `${rel.data}_${index}`);

        return atlasSetDoc([nomeColecao, id], {
            id,
            data: rel.data || "",
            dia: rel.dia || partes.dia,
            mes: rel.mes || partes.mes,
            ano: rel.ano || partes.ano,
            operador: rel.operador || "",
            totalGeral: Number(rel.totalGeral || 0),
            itens: rel.itens || [],
            editadoPor: rel.editadoPor || "",
            editadoEm: rel.editadoEm || "",
            historicoEdicoes: rel.historicoEdicoes || []
        });
    }));
}

async function atlasEnviarPlanos() {
    const historico = atlasParseJSON("atlas_plano_hist", []);
    await atlasLimparColecao("planos");

    await Promise.all(historico.map((rel, index) => {
        const id = atlasDocId(rel.id || `${rel.data}_${index}`);

        return atlasSetDoc(["planos", id], {
            id,
            data: rel.data || "",
            dataISO: rel.dataISO || "",
            dia: rel.dia || null,
            mes: rel.mes || null,
            ano: rel.ano || null,
            operador: rel.operador || "",
            totalGeral: Number(rel.totalGeral || 0),
            tiposLancamento: rel.tiposLancamento || [],
            resumo: rel.resumo || {},
            itens: rel.itens || [],
            editadoPor: rel.editadoPor || "",
            editadoEm: rel.editadoEm || "",
            historicoEdicoes: rel.historicoEdicoes || []
        });
    }));
}

async function atlasEnviarConferencia() {
    const pedidos = atlasParseJSON("atlas_conferencia_serra", []);
    await atlasLimparColecao("conferencia");

    await Promise.all(pedidos.map((pedido, index) => {
        const id = atlasDocId(pedido.id || `${pedido.data}_${pedido.pedidoNumero}_${index}`);

        return atlasSetDoc(["conferencia", id], {
            id,
            chavePedido: pedido.chavePedido || "",
            pedidoNumero: pedido.pedidoNumero || "",
            data: pedido.data || "",
            dia: pedido.dia || null,
            mes: pedido.mes || null,
            ano: pedido.ano || null,
            operadorSerra: pedido.operadorSerra || "",
            status: pedido.status || "aberto",
            finalizadoPor: pedido.finalizadoPor || "",
            finalizadoEm: pedido.finalizadoEm || "",
            unidades: pedido.unidades || []
        });
    }));
}

async function atlasEnviarDestinosPlano() {
    const destinos = atlasParseJSON("atlas_plano_destinos", []);
    await atlasSetDoc(["configuracoes", "destinos_plano"], {
        destinos
    });
}

async function atlasEnviarBackupLocalStorage() {
    const backup = {};
    if (!atlasFirebaseBloqueado && !localStorage.getItem(ATLAS_FIREBASE_SYNC_KEY)) {
        atlasLocalStorageSetItemOriginal.call(localStorage, ATLAS_FIREBASE_SYNC_KEY, String(Date.now()));
    }

    for (let i = 0; i < localStorage.length; i++) {
        const chave = localStorage.key(i);
        if (atlasFirebaseChaveSincronizada(chave) && chave !== "atlas_usuarios") {
            backup[chave] = localStorage.getItem(chave);
        }
    }

    await atlasSetDoc(["backups_localstorage", "ultimo_backup"], {
        dados: backup
    });
}

async function atlasFirebaseEnviarTudoOrganizadoInterno() {
    if (atlasFirebaseBloqueado) return;

    await atlasEnviarUsuariosExcluidos();
    await atlasEnviarUsuarios();
    await atlasEnviarInjecao();
    await atlasEnviarBobines();
    await atlasEnviarCorte("serra", "atlas_serra_hist");
    await atlasEnviarCorte("embalagem", "atlas_emb_hist");
    await atlasEnviarPlanos();
    await atlasEnviarConferencia();
    await atlasEnviarDestinosPlano();
    await atlasEnviarBackupLocalStorage();
}

function atlasFirebaseAgendarEnvio(chave) {
    if (!chave) return;
    if (!atlasFirebaseChaveSincronizada(chave)) return;
    if (atlasFirebaseBloqueado) return;

    clearTimeout(atlasFirebaseTimer);
    atlasFirebaseTimer = setTimeout(() => {
        atlasFirebaseEnviarTudoOrganizadoInterno().catch(erro => {
            console.error("Erro ao sincronizar Firebase:", erro);
        });
    }, 1000);
}

const atlasLocalStorageSetItemOriginal = localStorage.setItem;
const atlasLocalStorageRemoveItemOriginal = localStorage.removeItem;

localStorage.setItem = function(chave, valor) {
    const resultado = atlasLocalStorageSetItemOriginal.call(localStorage, chave, valor);
    if (!atlasFirebaseBloqueado && atlasFirebaseChaveSincronizada(chave) && chave !== ATLAS_FIREBASE_SYNC_KEY) {
        atlasFirebaseMarcarAlteracaoLocal();
    }
    atlasFirebaseAgendarEnvio(chave);
    return resultado;
};

localStorage.removeItem = function(chave) {
    const resultado = atlasLocalStorageRemoveItemOriginal.call(localStorage, chave);
    if (!atlasFirebaseBloqueado && atlasFirebaseChaveSincronizada(chave) && chave !== ATLAS_FIREBASE_SYNC_KEY) {
        atlasFirebaseMarcarAlteracaoLocal();
    }
    atlasFirebaseAgendarEnvio(chave);
    return resultado;
};

window.atlasFirebaseEnviarTudo = function() {
    atlasFirebaseEnviarTudoOrganizadoInterno()
        .then(() => alert("Dados organizados enviados para a nuvem."))
        .catch(erro => {
            console.error(erro);
            alert("Erro ao enviar dados para a nuvem: " + erro.message);
        });
};

window.atlasFirebaseStatus = {
    app: atlasFirebaseApp,
    db: atlasFirestore
};
async function atlasFirebaseBaixarBackupInicial() {
    const jaBaixou = sessionStorage.getItem("atlas_firebase_backup_baixado");
    if (jaBaixou === "sim") return;

    const snap = await getDoc(doc(atlasFirestore, "backups_localstorage", "ultimo_backup"));

    if (!snap.exists()) return;

    const dados = snap.data()?.dados || {};
    const chaves = Object.keys(dados);

    if (chaves.length === 0) return;
    if (!atlasFirebaseBackupPodeEntrar(dados)) return;

    atlasFirebaseBloqueado = true;

    chaves.forEach(chave => {
        if (chave !== "atlas_usuarios" && typeof dados[chave] === "string") {
            localStorage.setItem(chave, dados[chave]);
        }
    });

    atlasFirebaseBloqueado = false;

    sessionStorage.setItem("atlas_firebase_backup_baixado", "sim");
    location.reload();
}

setTimeout(() => {
    atlasFirebaseBaixarUsuariosDireto()
        .then(() => atlasFirebaseBaixarBackupInicial())
        .then(() => atlasFirebaseEnviarTudoOrganizadoInterno())
        .catch(erro => {
            console.error("Erro inicial Firebase:", erro);
        });
}, 1500);
async function atlasFirebaseAtualizarSemSair() {
    try {
        const atualizouUsuarios = await atlasFirebaseBaixarUsuariosDireto();
        if (atualizouUsuarios && typeof usuarioLogado !== "undefined" && usuarioLogado) {
            const usuarioAtualizado = atlasParseJSON("atlas_usuarios", []).find(usuario => String(usuario.id).toLowerCase() === String(usuarioLogado.id).toLowerCase());
            if (usuarioAtualizado) usuarioLogado = usuarioAtualizado;
        }

        if (Date.now() - atlasFirebaseUltimaAlteracaoLocal < 30000) return;

        const snap = await getDoc(doc(atlasFirestore, "backups_localstorage", "ultimo_backup"));
        if (!snap.exists()) return;

        const dados = snap.data()?.dados || {};
        const chaves = Object.keys(dados);

        if (chaves.length === 0) return;
        if (!atlasFirebaseBackupPodeEntrar(dados)) return;

        atlasFirebaseBloqueado = true;

        chaves.forEach(chave => {
            if (chave !== "atlas_usuarios" && typeof dados[chave] === "string") {
                localStorage.setItem(chave, dados[chave]);
            }
        });

        atlasFirebaseBloqueado = false;

        if (typeof usuarioLogado !== "undefined" && usuarioLogado) {
            if (typeof aplicarPermissoesUsuario === "function") aplicarPermissoesUsuario();
            if (typeof aplicarPreferenciasVisuaisUsuario === "function") aplicarPreferenciasVisuaisUsuario();
        }
    } catch (erro) {
        console.error("Erro ao atualizar dados da nuvem:", erro);
    }
}

setInterval(() => {
    atlasFirebaseAtualizarSemSair();
}, 15000);

window.atlasFirebaseForcarAtualizacao = function() {
    return atlasFirebaseBaixarUsuariosDireto()
        .then(() => atlasFirebaseBaixarBackupInicial())
        .then(() => {
            if (typeof usuariosSistema !== "undefined") {
                usuariosSistema = atlasParseJSON("atlas_usuarios", usuariosSistema);
            }
            return true;
        });
};

window.atlasFirebaseRemoverUsuarioExcluido = function(idUsuario) {
    return atlasFirebaseRemoverUsuarioExcluidoDaNuvem(idUsuario)
        .then(() => atlasFirebaseEnviarTudoOrganizadoInterno())
        .catch(erro => {
            console.error("Erro ao remover usuario excluido:", erro);
        });
};

window.atlasFirebaseLimparUsuarioExcluido = function(idUsuario) {
    return atlasFirebaseLimparUsuarioExcluidoDaNuvem(idUsuario)
        .catch(erro => {
            console.error("Erro ao limpar usuario excluido:", erro);
        });
};

window.atlasFirebaseSincronizarAgora = function() {
    return atlasFirebaseEnviarTudoOrganizadoInterno().catch(erro => {
        console.error("Erro ao sincronizar agora:", erro);
    });
};


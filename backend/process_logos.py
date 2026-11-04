import os
import zipfile
import numpy as np
from PIL import Image

def process_logos():
    base_dir = r"C:\Users\JORDY\Desktop\Sistema_inmo"
    input_path = os.path.join(base_dir, "logo_base.png.jpeg")
    
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"No se encontró el logo base en: {input_path}")
    
    print(f"Cargando imagen original desde: {input_path}")
    img = Image.open(input_path).convert("RGB")
    arr = np.array(img, dtype=np.float32)
    
    # 1. Detectar fondo blanco y calcular caja delimitadora (trim)
    is_white = (arr[:, :, 0] > 238) & (arr[:, :, 1] > 238) & (arr[:, :, 2] > 238)
    y_idx, x_idx = np.where(~is_white)
    
    pad = 16
    ymin = max(0, y_idx.min() - pad)
    ymax = min(arr.shape[0] - 1, y_idx.max() + pad)
    xmin = max(0, x_idx.min() - pad)
    xmax = min(arr.shape[1] - 1, x_idx.max() + pad)
    
    # Submatriz recortada
    trimmed_rgb = arr[ymin:ymax+1, xmin:xmax+1]
    h, w, _ = trimmed_rgb.shape
    print(f"Dimensiones recortadas (trim): {w}x{h} px")
    
    # ==========================================================
    # A. logo-original.jpg (Fondo blanco limpio recortado)
    # ==========================================================
    img_original = Image.fromarray(np.clip(trimmed_rgb, 0, 255).astype(np.uint8), "RGB")
    
    # ==========================================================
    # B. logo-transparent.png (Transparente sin fondo)
    # ==========================================================
    r = trimmed_rgb[:, :, 0]
    g = trimmed_rgb[:, :, 1]
    b = trimmed_rgb[:, :, 2]
    
    # Cálculo de alfa suave para evitar halos blancos en los bordes
    min_channel = np.minimum(np.minimum(r, g), b)
    # Píxeles completamente blancos (> 240) -> Alpha = 0
    # Píxeles con color o texto (< 200) -> Alpha = 255
    alpha = np.clip((242.0 - min_channel) / 42.0 * 255.0, 0, 255)
    
    # Asegurar que píxeles predominantemente blancos tengan Alpha = 0
    pure_white = (r > 238) & (g > 238) & (b > 238)
    alpha[pure_white] = 0
    
    rgba_trans = np.zeros((h, w, 4), dtype=np.uint8)
    rgba_trans[:, :, :3] = np.clip(trimmed_rgb, 0, 255).astype(np.uint8)
    rgba_trans[:, :, 3] = alpha.astype(np.uint8)
    img_trans = Image.fromarray(rgba_trans, "RGBA")
    
    # ==========================================================
    # C. logo-dark-bg.png (Especial para fondo oscuro / Sidebar)
    # Píxeles oscuros (#1E292B) -> Blanco (#FFFFFF)
    # Píxeles turquesa (#00B89F) -> Se mantienen intactos
    # ==========================================================
    rgba_dark = rgba_trans.copy()
    
    # Clasificación de turquesa: Verde y Azul altos, significativamente superiores a Rojo
    is_turquoise = (g > 105) & (b > 85) & (g > r * 1.35)
    
    # Píxeles visibles que NO son turquesa se transforman a blanco nítido (#FFFFFF)
    is_dark_visible = (~is_turquoise) & (rgba_dark[:, :, 3] > 0)
    rgba_dark[is_dark_visible, 0] = 255
    rgba_dark[is_dark_visible, 1] = 255
    rgba_dark[is_dark_visible, 2] = 255
    
    img_dark = Image.fromarray(rgba_dark, "RGBA")
    
    # ==========================================================
    # D. favicon.png (64x64 y 192x192)
    # Centrado en el isotipo del techo turquesa con la ventana
    # ==========================================================
    # Extraer el isotipo (techo + ventana + chimenea)
    roof_mask = (~is_white) & (np.arange(arr.shape[0])[:, None] >= 380) & (np.arange(arr.shape[0])[:, None] <= 538) & (np.arange(arr.shape[1])[None, :] >= 525) & (np.arange(arr.shape[1])[None, :] <= 905)
    ry, rx = np.where(roof_mask)
    
    r_ymin, r_ymax = max(0, ry.min() - 4), min(arr.shape[0] - 1, ry.max() + 4)
    r_xmin, r_xmax = max(0, rx.min() - 4), min(arr.shape[1] - 1, rx.max() + 4)
    
    roof_rgb = arr[r_ymin:r_ymax+1, r_xmin:r_xmax+1]
    rh, rw, _ = roof_rgb.shape
    
    # Alpha para el isotipo
    rr = roof_rgb[:, :, 0]
    rg = roof_rgb[:, :, 1]
    rb = roof_rgb[:, :, 2]
    r_min = np.minimum(np.minimum(rr, rg), rb)
    r_alpha = np.clip((242.0 - r_min) / 42.0 * 255.0, 0, 255)
    r_alpha[(rr > 238) & (rg > 238) & (rb > 238)] = 0
    
    roof_rgba = np.zeros((rh, rw, 4), dtype=np.uint8)
    roof_rgba[:, :, :3] = np.clip(roof_rgb, 0, 255).astype(np.uint8)
    roof_rgba[:, :, 3] = r_alpha.astype(np.uint8)
    img_roof = Image.fromarray(roof_rgba, "RGBA")
    
    # Montar isotipo centrado en lienzo cuadrado con margen estético del 12%
    square_size = max(rw, int(rh * 1.8)) + 30
    canvas_square = Image.new("RGBA", (square_size, square_size), (0, 0, 0, 0))
    pos_x = (square_size - rw) // 2
    pos_y = (square_size - rh) // 2
    canvas_square.paste(img_roof, (pos_x, pos_y), img_roof)
    
    img_favicon_64 = canvas_square.resize((64, 64), Image.Resampling.LANCZOS)
    img_favicon_192 = canvas_square.resize((192, 192), Image.Resampling.LANCZOS)
    img_favicon_32 = canvas_square.resize((32, 32), Image.Resampling.LANCZOS)
    
    # ==========================================================
    # Directorios de Destino
    # ==========================================================
    dirs_to_save = [
        os.path.join(base_dir, "frontend", "public", "logos"),
        os.path.join(base_dir, "backend", "public", "logos"),
    ]
    
    for d in dirs_to_save:
        os.makedirs(d, exist_ok=True)
    
    files_created = {}
    
    # Guardar en cada directorio
    for d in dirs_to_save:
        p_orig = os.path.join(d, "logo-original.jpg")
        img_original.save(p_orig, "JPEG", quality=95)
        files_created["logo-original.jpg"] = p_orig
        
        p_trans = os.path.join(d, "logo-transparent.png")
        img_trans.save(p_trans, "PNG", optimize=True)
        files_created["logo-transparent.png"] = p_trans
        
        p_dark = os.path.join(d, "logo-dark-bg.png")
        img_dark.save(p_dark, "PNG", optimize=True)
        files_created["logo-dark-bg.png"] = p_dark
        
        p_fav = os.path.join(d, "favicon.png")
        img_favicon_64.save(p_fav, "PNG")
        files_created["favicon.png"] = p_fav
        
        p_fav192 = os.path.join(d, "favicon-192.png")
        img_favicon_192.save(p_fav192, "PNG")
        files_created["favicon-192.png"] = p_fav192
    
    # También colocar favicon.png en frontend/public/favicon.png y favicon.ico
    frontend_public = os.path.join(base_dir, "frontend", "public")
    img_favicon_64.save(os.path.join(frontend_public, "favicon.png"), "PNG")
    img_favicon_64.save(os.path.join(frontend_public, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    
    # ==========================================================
    # Empaquetar en .zip
    # ==========================================================
    zip_paths = [
        os.path.join(base_dir, "logos_vendeymas.zip"),
        os.path.join(frontend_public, "logos_vendeymas.zip"),
    ]
    
    source_dir = dirs_to_save[0]
    items_to_zip = [
        "logo-original.jpg",
        "logo-transparent.png",
        "logo-dark-bg.png",
        "favicon.png",
        "favicon-192.png",
    ]
    
    for zp in zip_paths:
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as zf:
            for item in items_to_zip:
                item_full = os.path.join(source_dir, item)
                if os.path.exists(item_full):
                    zf.write(item_full, arcname=item)
        print(f"Archivo ZIP generado con éxito: {zp} ({os.path.getsize(zp)} bytes)")
    
    print("\nProcesamiento gráfico completado exitosamente:")
    for name, path in files_created.items():
        print(f"  - {name}: {os.path.getsize(path)} bytes")

if __name__ == "__main__":
    process_logos()

import os
import sys
import shutil
import zipfile
import hashlib

def package_submission():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_dir = os.path.abspath(os.path.join(repo_root, ".."))
    zip_path = os.path.join(out_dir, "EchoGuard_Final_Submission.zip")
    staging_dir = os.path.join(out_dir, "staging_echoguard")

    print(f"Repository root: {repo_root}")
    print(f"Target ZIP path: {zip_path}")

    if os.path.exists(staging_dir):
        shutil.rmtree(staging_dir)
    os.makedirs(staging_dir, exist_ok=True)

    base_folder_name = "EchoGuard_Final_Submission"
    pkg_dir = os.path.join(staging_dir, base_folder_name)
    os.makedirs(pkg_dir, exist_ok=True)

    # 1. Copy root files
    root_files = [
        "README.md",
        "RIME_EVIDENCE.md",
        "requirements.txt",
        "Procfile",
        ".env.example",
        ".gitignore",
    ]
    for rf in root_files:
        src = os.path.join(repo_root, rf)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(pkg_dir, rf))
            print(f"  [+] Copied: {rf}")
        else:
            print(f"  [!] Missing root file: {rf}")

    # 2. Copy directories with explicit filtering
    def copy_filtered_dir(rel_path, exclude_names=None, exclude_exts=None):
        src_path = os.path.join(repo_root, rel_path)
        dst_path = os.path.join(pkg_dir, rel_path)
        if not os.path.exists(src_path):
            print(f"  [!] Directory not found: {rel_path}")
            return

        exclude_names = exclude_names or set()
        exclude_exts = exclude_exts or set()

        for root, dirs, files in os.walk(src_path):
            # Prune excluded directory names
            dirs[:] = [d for d in dirs if d not in exclude_names and not d.startswith(".")]

            rel_root = os.path.relpath(root, src_path)
            target_sub = os.path.normpath(os.path.join(dst_path, rel_root))
            os.makedirs(target_sub, exist_ok=True)

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if file in exclude_names or ext in exclude_exts or file.startswith("."):
                    continue
                shutil.copy2(os.path.join(root, file), os.path.join(target_sub, file))

    print("\nCopying agent/...")
    copy_filtered_dir("agent", exclude_names={"__pycache__", ".pytest_cache"}, exclude_exts={".pyc"})

    print("Copying server/...")
    copy_filtered_dir("server", exclude_names={"__pycache__", ".pytest_cache"}, exclude_exts={".pyc"})

    print("Copying scripts/...")
    copy_filtered_dir("scripts", exclude_names={"__pycache__", ".pytest_cache", "package_submission.py"}, exclude_exts={".pyc"})

    print("Copying tests/...")
    copy_filtered_dir("tests", exclude_names={"__pycache__", ".pytest_cache"}, exclude_exts={".pyc"})

    print("Copying frontend/ (excluding node_modules)...")
    copy_filtered_dir("frontend", exclude_names={"node_modules", ".git", ".vite", ".pytest_cache"}, exclude_exts={})

    print("Copying demo/...")
    copy_filtered_dir("demo", exclude_names={}, exclude_exts={})

    # Security check on staging directory
    print("\n--- Running Pre-Zip Security Scan on Staged Files ---")
    secrets_found = []
    staged_file_count = 0
    total_uncompressed_bytes = 0

    for root, dirs, files in os.walk(pkg_dir):
        for f in files:
            staged_file_count += 1
            fpath = os.path.join(root, f)
            size = os.path.getsize(fpath)
            total_uncompressed_bytes += size
            
            # Check forbidden filenames
            if f == ".env" or f.startswith(".env.") and not f.endswith(".example"):
                secrets_found.append(f"Forbidden env file: {fpath}")
            
            # Check forbidden extensions
            if f.endswith(".pem") or f.endswith(".key") or f.endswith(".pfx"):
                secrets_found.append(f"Private key file: {fpath}")

    if secrets_found:
        print("SECURITY CHECK FAILED:")
        for s in secrets_found:
            print(f"  {s}")
        sys.exit(1)
    else:
        print(f"Security check passed! {staged_file_count} files ({total_uncompressed_bytes / (1024*1024):.1f} MB uncompressed) clean.")

    # 3. Create ZIP archive
    print(f"\nCreating ZIP archive: {zip_path}...")
    if os.path.exists(zip_path):
        os.remove(zip_path)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
        for root, dirs, files in os.walk(staging_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_zip_path = os.path.relpath(abs_file, staging_dir)
                zipf.write(abs_file, rel_zip_path)

    zip_size_bytes = os.path.getsize(zip_path)
    zip_size_mb = zip_size_bytes / (1024 * 1024)
    print(f"ZIP created successfully! Size: {zip_size_mb:.2f} MB ({zip_size_bytes:,} bytes)")

    # 4. Verify ZIP integrity by test extracting
    verify_dir = os.path.join(out_dir, "test_extract_verify")
    if os.path.exists(verify_dir):
        shutil.rmtree(verify_dir)
    os.makedirs(verify_dir, exist_ok=True)

    print("\n--- Verifying ZIP Extraction Integrity ---")
    with zipfile.ZipFile(zip_path, "r") as zipf:
        test_namelist = zipf.namelist()
        print(f"Total entries in ZIP: {len(test_namelist)}")
        
        # Verify top-level folder
        all_top_level = all(n.startswith(base_folder_name + "/") or n == base_folder_name for n in test_namelist)
        print(f"All paths start with '{base_folder_name}/': {all_top_level}")
        assert all_top_level, "Not all paths have base folder prefix!"

        # Verify key files
        essential_files = [
            f"{base_folder_name}/README.md",
            f"{base_folder_name}/RIME_EVIDENCE.md",
            f"{base_folder_name}/requirements.txt",
            f"{base_folder_name}/Procfile",
            f"{base_folder_name}/.env.example",
            f"{base_folder_name}/.gitignore",
            f"{base_folder_name}/server/main.py",
            f"{base_folder_name}/agent/main.py",
            f"{base_folder_name}/frontend/dist/index.html",
            f"{base_folder_name}/demo/EchoGuard_Demo.mp4",
        ]
        for ef in essential_files:
            assert ef in test_namelist, f"Missing essential file in zip: {ef}"
            print(f"  [PASS] Verified in ZIP: {ef}")

        # Test extraction
        zipf.extractall(verify_dir)
        print("Test extraction succeeded!")

    # Cleanup staging and verify directories
    shutil.rmtree(staging_dir)
    shutil.rmtree(verify_dir)
    print("Cleaned up temporary staging folders.")

    # Compute SHA-256 of the final ZIP
    sha256 = hashlib.sha256()
    with open(zip_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    zip_hash = sha256.hexdigest()
    print(f"\nFinal Submission ZIP SHA-256: {zip_hash}")

    print("\n==================================================================")
    print("  ECHOGUARD FINAL SUBMISSION ZIP GENERATED AND VERIFIED!          ")
    print("==================================================================")

if __name__ == "__main__":
    package_submission()

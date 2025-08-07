#!/bin/bash

# Build and deploy p5go art projects

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
ART_GO_DIR="$PROJECT_ROOT/art/go"
PUBLIC_ART_DIR="$PROJECT_ROOT/public/art/go"
PUBLIC_WASM_DIR="$PROJECT_ROOT/public/wasm"

echo "Building p5go art projects..."

# Create directories if they don't exist
mkdir -p "$PUBLIC_ART_DIR"
mkdir -p "$PUBLIC_WASM_DIR"

# Copy wasm_exec.js if not exists
if [ ! -f "$PUBLIC_WASM_DIR/wasm_exec.js" ]; then
    cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" "$PUBLIC_WASM_DIR/"
fi

# Function to build a single Go project
build_project() {
    local project_name=$1
    local project_path="$ART_GO_DIR/$project_name"
    
    if [ ! -d "$project_path" ]; then
        echo "Project $project_name not found, skipping..."
        return
    fi
    
    echo "Building $project_name..."
    
    cd "$project_path"
    
    # Build WASM
    GOOS=js GOARCH=wasm go build -o "$PUBLIC_WASM_DIR/go_${project_name}.wasm" main.go
    
    # Create output directory for this project
    mkdir -p "$PUBLIC_ART_DIR/$project_name"
    
    # Generate GIF using the existing art_gif.sh script if available
    if [ -f "$SCRIPT_DIR/art_gif.sh" ]; then
        echo "Generating GIF for $project_name..."
        # Run the project for a few seconds and capture as GIF
        # This would require a headless browser setup
        # For now, we'll create a placeholder
        touch "$PUBLIC_ART_DIR/$project_name/art.gif"
    fi
    
    echo "✓ Built $project_name"
}

# Build all projects
for dir in "$ART_GO_DIR"/*/ ; do
    if [ -d "$dir" ]; then
        project_name=$(basename "$dir")
        # Skip go.mod and go.sum
        if [ "$project_name" != "go.mod" ] && [ "$project_name" != "go.sum" ]; then
            build_project "$project_name"
        fi
    fi
done

echo "All p5go art projects built successfully!"
echo "WASM files are in: $PUBLIC_WASM_DIR"
echo "Art files are in: $PUBLIC_ART_DIR"
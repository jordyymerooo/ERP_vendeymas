<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Lot;
use App\Models\LotDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LotDocumentController extends Controller
{
    /**
     * Lista todos los documentos vinculados a un lote.
     */
    public function indexByLot(int|string $lotId): JsonResponse
    {
        $lot = Lot::findOrFail($lotId);
        $documents = LotDocument::where('lot_id', $lot->id)
            ->with(['lot', 'customer'])
            ->orderBy('uploaded_at', 'desc')
            ->get()
            ->map(fn($doc) => $this->formatDocument($doc));

        return response()->json([
            'success' => true,
            'data' => $documents,
        ]);
    }

    /**
     * Lista todos los documentos de todos los lotes de un cliente.
     */
    public function indexByCustomer(int|string $customerId): JsonResponse
    {
        $customer = Customer::findOrFail($customerId);
        $documents = LotDocument::where('customer_id', $customer->id)
            ->with(['lot', 'customer'])
            ->orderBy('uploaded_at', 'desc')
            ->get()
            ->map(fn($doc) => $this->formatDocument($doc));

        return response()->json([
            'success' => true,
            'data' => $documents,
        ]);
    }

    /**
     * Sube un contrato o documento real a storage/app/public/contracts
     */
    public function store(Request $request, int|string $lotId): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240', // Hasta 10MB
            'document_type' => 'required|string|max:120',
            'customer_id' => 'nullable|exists:customers,id',
        ]);

        $lot = Lot::findOrFail($lotId);
        $customerId = $request->input('customer_id') ?: $lot->customer_id;

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $fileSize = $this->formatBytes($file->getSize());

        Storage::disk('public')->makeDirectory('contracts');
        $storedPath = $file->store('contracts', 'public');

        $document = LotDocument::create([
            'lot_id' => $lot->id,
            'customer_id' => $customerId,
            'document_type' => $request->input('document_type'),
            'file_name' => $originalName,
            'file_path' => $storedPath,
            'file_size' => $fileSize,
            'uploaded_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Documento adjuntado y guardado con éxito.',
            'data' => $this->formatDocument($document->load(['lot', 'customer'])),
        ], 201);
    }

    /**
     * Descarga o visualiza el documento guardado.
     */
    public function download(int|string $id)
    {
        $document = LotDocument::findOrFail($id);

        if (!Storage::disk('public')->exists($document->file_path)) {
            return response()->json(['message' => 'El archivo no existe en el almacenamiento.'], 404);
        }

        return Storage::disk('public')->response(
            $document->file_path,
            $document->file_name
        );
    }

    /**
     * Elimina el documento físico y su registro en la BD.
     */
    public function destroy(int|string $id): JsonResponse
    {
        $document = LotDocument::findOrFail($id);

        if (Storage::disk('public')->exists($document->file_path)) {
            Storage::disk('public')->delete($document->file_path);
        }

        $document->delete();

        return response()->json([
            'success' => true,
            'message' => 'Documento eliminado correctamente.',
        ]);
    }

    private function formatDocument(LotDocument $doc): array
    {
        return [
            'id' => $doc->id,
            'lot_id' => $doc->lot_id,
            'lot_number' => $doc->lot?->lot_number ?? 'Lote',
            'customer_id' => $doc->customer_id,
            'customer_name' => $doc->customer?->name ?? 'Cliente',
            'document_type' => $doc->document_type,
            'file_name' => $doc->file_name,
            'file_path' => $doc->file_path,
            'file_size' => $doc->file_size ?? 'N/A',
            'uploaded_at' => $doc->uploaded_at ? $doc->uploaded_at->format('d/m/Y H:i') : '',
            'file_url' => url('/api/documents/' . $doc->id . '/download'),
            'is_pdf' => str_ends_with(strtolower($doc->file_name), '.pdf'),
        ];
    }

    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}

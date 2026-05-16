using Microsoft.EntityFrameworkCore;
using Api.Data;
using Api.Models;

namespace Api.Services;

public class GanhoService
{
    private readonly ApplicationDbContext _context;
    
    public GanhoService(ApplicationDbContext context)
    {
        _context = context;
    }
    
    public async Task<List<Ganho>> GetByUserAsync(int userId)
    {
        return await _context.Ganhos
            .Where(g => g.UserId == userId)
            .OrderByDescending(g => g.Data)
            .ToListAsync();
    }
    
    public async Task<Ganho?> GetByIdAsync(int id)
    {
        return await _context.Ganhos.FindAsync(id);
    }
    
    public async Task<Ganho> CreateAsync(Ganho ganho)
    {
        _context.Ganhos.Add(ganho);
        await _context.SaveChangesAsync();
        return ganho;
    }
    
    public async Task<Ganho> UpdateAsync(Ganho ganho)
    {
        _context.Entry(ganho).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return ganho;
    }
    
    public async Task DeleteAsync(int id)
    {
        var ganho = await _context.Ganhos.FindAsync(id);
        if (ganho != null)
        {
            _context.Ganhos.Remove(ganho);
            await _context.SaveChangesAsync();
        }
    }
}
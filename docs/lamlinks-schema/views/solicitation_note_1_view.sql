-- dbo.solicitation_note_1_view



/* view solicitation_note_1_view: add view */


/* view solicitation_note_1_view: add view */


/* view solicitation_note_1_view: add view */

/* view solicitation_note_1_view: add view */
CREATE VIEW dbo.solicitation_note_1_view
AS
SELECT        dbo.kah_tab.anutyp_kah, dbo.kah_tab.a_note_kah, dbo.sol_part_0_query.idnk09_k09, dbo.sol_part_0_query.idnkc4_kc4
FROM            dbo.kah_tab INNER JOIN
                         dbo.sol_part_0_query ON dbo.kah_tab.idnanu_kah = dbo.sol_part_0_query.idnkc4_kc4
WHERE        (dbo.kah_tab.anutbl_kah = 'kc4')





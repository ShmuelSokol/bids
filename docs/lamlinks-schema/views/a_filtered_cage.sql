-- dbo.a_filtered_cage



/* view a_filtered_cage: add view */


/* view a_filtered_cage: add view */


/* view a_filtered_cage: add view */

/* view a_filtered_cage: add view */


/* view a_filtered_cage: add view */
CREATE VIEW [dbo].[a_filtered_cage]
AS
SELECT DISTINCT 
                      K52_tab.rlenam_k52, K39_tab.s_code_k39, K12_tab.e_name_k12, K12_tab.idnk12_k12, K39_tab.idnk39_k39, K52_tab.idnk52_k52, K54_tab.keynam_k54
FROM         dbo.k52_tab AS K52_tab INNER JOIN
                      dbo.k51_tab AS K51_tab ON K52_tab.idnk51_k52 = K51_tab.idnk51_k51 INNER JOIN
                      dbo.k53_tab AS K53_tab ON K52_tab.idnk52_k52 = K53_tab.idnk52_k53 INNER JOIN
                      dbo.k54_tab AS K54_tab ON K53_tab.idnk54_k53 = K54_tab.idnk54_k54 INNER JOIN
                      dbo.k60_tab AS K60_tab INNER JOIN
                      dbo.k39_tab AS K39_tab ON K60_tab.idnk39_k60 = K39_tab.idnk39_k39 ON K52_tab.idnk52_k52 = K60_tab.idnk52_k60 AND 
                      K53_tab.keyval_k53 = K39_tab.s_code_k39 INNER JOIN
                      dbo.k12_tab AS K12_tab ON K39_tab.idnk12_k39 = K12_tab.idnk12_k12
WHERE     (K51_tab.flrtyp_k51 = 'supplier') AND (K54_tab.keycod_k54 IN (2, 8, 38, 1002))






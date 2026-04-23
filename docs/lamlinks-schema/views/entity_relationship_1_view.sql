-- dbo.entity_relationship_1_view



/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */

/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */


/* view entity_relationship_1_view: add view */
/* view entity_relationship_1_view: add view 
 view entity_relationship_1_view: add view 
 view entity_relationship_1_view: add view 
 view entity_relationship_1_view: add view 
 view entity_relationship_1_view: add view 
 view entity_relationship_1_view: add view */
CREATE VIEW [dbo].[entity_relationship_1_view]
AS
SELECT        too_ka7_tab.gduset_ka7, too_ka7_tab.d_code_ka7 AS d_code_too, too_ka7_tab.d_name_ka7 AS d_name_too, too_ka7_tab.d_attn_ka7 AS d_attn_too, too_ka7_tab.d_emal_ka7 AS d_emal_too, 
                         too_ka7_tab.d_phon_ka7 AS d_phon_too, too_ka7_tab.d_faxn_ka7 AS d_faxn_too, frm_k12_tab.e_code_k12 AS e_code_ptr, frm_k12_tab.e_name_k12 AS e_name_ptr, frm_k12_tab.idnk12_k12 AS idnk12_ptr, 
                         too_ka7_tab.idnka7_ka7 AS idnka7_too, dbo.ka6_tab.idngdu_ka6, dbo.ka6_tab.gdutbl_ka6, dbo.ka6_tab.idnka6_ka6, dbo.ka6_tab.frozen_ka6, too_k12_tab.idnk12_k12 AS idnk12_too
FROM            dbo.ka6_tab INNER JOIN
                         dbo.k12_tab AS frm_k12_tab ON dbo.ka6_tab.idngdu_ka6 = frm_k12_tab.idnk12_k12 INNER JOIN
                         dbo.ka7_tab AS too_ka7_tab ON dbo.ka6_tab.idnka7_ka6 = too_ka7_tab.idnka7_ka7 INNER JOIN
                         dbo.k12_tab AS too_k12_tab ON too_ka7_tab.idnk12_ka7 = too_k12_tab.idnk12_k12
WHERE        (dbo.ka6_tab.gdutbl_ka6 = 'k12')













-- dbo.cleanLineBreaks


CREATE function [dbo].[cleanLineBreaks] (@text varchar(max)) returns varchar(max)
begin

declare @cleanText varchar(max);
declare @retrunText varchar(max) = null;

--replace char(13) with char(10), this makes it easier to clean both char(13) and char(10)
set @cleanText = REPLACE(isnull(@text, ''), char(13), char(10));

--ltrim before line breaks
while CHARINDEX(' ' + char(10), @cleanText, 1) > 0
	set @cleanText = REPLACE(@cleanText, ' ' + char(10), char(10));

--rtrim after line breaks
while CHARINDEX(char(10) + ' ', @cleanText, 1) > 0
	set @cleanText = REPLACE(@cleanText, char(10) + ' ', char(10));

--double line breaks
while CHARINDEX(char(10) + char(10), @cleanText, 1) > 0
	set @cleanText = REPLACE(@cleanText, char(10) + char(10), char(10));

--leading line break
--len function in sql server does not include trailing spaces, so we add an 'a' at the end
if left(@cleanText, 1) = char(10)
	set @cleanText = right(@cleanText, len(@cleanText + 'a') - 2);

--trailing line break
if right(@cleanText, 1) = char(10)
	set @cleanText = left(@cleanText, len(@cleanText) - 1);

--ltrim, rtrim is needed if there were never any line breaks in @text
set @retrunText = REPLACE(@cleanText, char(10), char(13) + char(10));

return @retrunText;
end
